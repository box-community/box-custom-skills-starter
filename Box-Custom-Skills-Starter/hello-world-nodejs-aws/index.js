/**
 * @fileoverview The lambda handler.
 */

/**
 * Module dependencies
 */

// @flow
const util = require('util');
const BoxSDK = require('box-node-sdk');
const Logger = require('box-built-in-skills-kit/logger-manager');
const SkillsManager = require('box-built-in-skills-kit/skills-manager');
const WhitelistManager = require('box-built-in-skills-kit/ip-whitelist-manager');
const ErrorParser = require('box-built-in-skills-kit/error-parser');
const { SkillInvocations, UsageUnitEnum, StatusEnum } = require('./skill-invocations.js');
const request = require('request').defaults({ encoding: null });
// TODO: Create a unique id for your custom skill
const SKILL_NAME = 'box-skill-custom-node';

const sdk = new BoxSDK({
    clientID: 'BoxSkillsClientId',
    clientSecret: 'BoxSkillsClientSecret'
});

const getBase64URIFromURL = async(thumbnailUrl) => {
    return new Promise((resolve) =>
        request.get(thumbnailUrl, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                const base64URI = `data:${response.headers['content-type']};base64,${Buffer.from(body).toString(
                    'base64'
                )}`;
                // e.g. of a Base 64 encoded URI:
                // data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAcFBQYFBAcGBQYIBwcIChELCgkJChUPEAwRGBU.....
                resolve(base64URI);
            } else {
                // Do nothing, set the url again
                Logger.logError(`Error downloading thumbnail: ${thumbnailUrl}`);
                resolve(thumbnailUrl);
            }
        })
    );
};


/**
 * Main function processing a box event to make IBM speech-to-text call
 *
 * @param event - reduced event object from handler function
 */
const processBoxEventWithMLProvider = async (event: Object) => {
    const { source, token, skillInvocations } = event;
    const { id: fileId } = source;
    const { read: { access_token: readAccessToken }, write: { access_token: writeAccessToken } } = token;
    const readClient = sdk.getBasicClient(readAccessToken);
    try {
        Logger.logInfo(`Box event received, uploading file (id: ${fileId}) to ML Service..`);
        // TODO: Develop your code here that passes fileId or file content to ML APIs.
        // After recieving response, convert it to Box Skills specific metadata and 
        // determine the correct usage unit and value to record.

        Logger.logInfo('Writing down ML results in skills metadata card format');
        
        //Examples of three types of cards: keyword, transcript.
        const keywordData = [{ text :`Hello World from file ${fileId}`, type: 'text'}];
        const sampleKeywordCard = skillInvocations.keywordCardTemplate(keywordData);

        const transcriptData = [{ text :`Hello World from file ${fileId}`, appears: [{start: 0, end: 1}]}];
        const sampleTranscriptCard = skillInvocations.transcriptCardTemplate(transcriptData);

        // timeline data can contain an image_url property with a string value of a thumbnail image.
        // e.g. of a Base 64 encoded URI for an image url:
        // data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAcFBQYFBAcGBQYIBwcIChELCgkJChUPEAwRGBU.....
        sampleThumbnailUrl = 'https://pbs.twimg.com/profile_images/885529357904510976/tM0vLiYS_400x400.jpg';
        const timeLineData = [{ 
            type: 'image', 
            text :`Hello World from file ${fileId}`, 
            image_url: await getBase64URIFromURL(sampleThumbnailUrl),
            appears: [{start: 0, end: 1}]}];
        const sampletimeLineCard = skillInvocations.timeLineCardTemplate(timeLineData);

        Logger.logInfo(JSON.stringify(sampleKeywordCard));

        const sampleUsage = {unit: UsageUnitEnum.FILES.value, value: 1};
        skillInvocations.saveMetadata([sampletimeLineCard, sampleKeywordCard, sampleTranscriptCard], sampleUsage);
    } catch (error) {
        Logger.logDebug(`error caught: ${util.inspect(error)}`);
        const errorParser = new ErrorParser(error, fileId);
        errorParser.processBoxError();
        const errorCode = errorParser.getSkillsErrorCode();
        const errorMessage = errorParser.getSkillsErrorMessage();
        const errDesc = `Error fetching breakdowns and saving as skills metadata: ${errorCode} - ${errorMessage}`;
        Logger.logError(errDesc);
        skillInvocations.saveErrorMetadata(StatusEnum.PERMANENT_FAILURE.value, errorCode, errorMessage);
    }
};

/**
 * This is the main function that the Lamba will call when invoked.
 *
 * @param event - data from the event, including the payload of the webhook, that triggered this function call
 * @param context - additional context information from the request (unused in this example)
 * @param callback - the function to call back to once finished
 */
const handler = (event: Object, context: Object, callback: Function) => {
    if (!WhitelistManager.isValidBoxIP(event)) {
        // Exit Lambda, don't execute anything further
        callback(null, {
            statusCode: 403,
            body: 'Event sender not authorized'
        });
    }
    // Extract event body
    const { body } = event;
    if (!body) {
        Logger.logError('Missing event body');
        return;
    }
    const eventBodyJson = JSON.parse(body);
    const { source, token, id: boxId, skill } = eventBodyJson;
    Logger.setupLogger(boxId);
    const skillInvocations = new SkillInvocations(
        sdk.getBasicClient(token.write.access_token),
        skill.id,
        source.id,
        boxId,
        SKILL_NAME
    );
    skillInvocations.saveStatus(StatusEnum.PROCESSING.value);
    try {
        processBoxEventWithMLProvider({
            source,
            token, 
            skillInvocations
        });
    } catch (e) {
        Logger.logError(`Runtime exception caught: ${e}`);
        if (e.message) {
            const { errorCode, errorMessage } = JSON.parse(e.message);
            skillInvocations.saveErrorMetadata(StatusEnum.PERMANENT_FAILURE.value, errorCode, errorMessage);
        }
    } finally {
        callback(null, {
            statusCode: 200,
            body: 'Event request processed'
        });
    }
};

module.exports = { handler };
