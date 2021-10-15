/**
 * @fileoverview Manager for the Box Files Resource
 */

const urlPath = require('box-node-sdk/lib/util/url-path');
const Enum = require('enum');
const Logger = require('box-built-in-skills-kit/logger-manager');

const StatusEnum = new Enum({
    INVOKED: 'invoked',
    PROCESSING: 'processing',
    TRANSIENT_FAILURE: 'transient_failure',
    PERMANENT_FAILURE: 'permanent_failure',
    SUCCESS: 'success'
});
const UsageUnitEnum = new Enum({
    FILES: 'files',
    SECONDS: 'seconds',
    PAGES: 'pages',
    WORDS: 'words'
});

// Base path for all files endpoints
const BASE_PATH = '/skill_invocations';
const SKILLS_SERVICE_TYPE = 'service';
const SKILLS_METADATA_CARD_TYPE = 'skill_card';
const SKILLS_METADATA_INVOCATION_TYPE = 'skill_invocation';
const CARD_TYPE_TRANSCRIPT = 'transcript';
const CARD_TITLE_TRANSCRIPT = 'Transcript';
const CARD_TYPE_KEYWORD = 'keyword';
const CARD_TITLE_KEYWORD = 'Topics';
const CARD_TYPE_TIMELINE = 'timeline';
const CARD_TITLE_TIMELINE = 'Faces';

/**
 * Simple manager for interacting with all 'Skill Invocations' endpoints and actions.
 *
 * @param {BoxClient} client The Box API Client that is responsible for making calls to the API
 * @constructor
 */
function SkillInvocations(client, skillId, fileId, boxId, skillName) {
    // Attach the client, for making API calls
    this.client = client;
    this.skillId = skillId;
    this.fileId = fileId;
    this.boxId = boxId;
    this.skillName = skillName;
}

/**
 * This will return a metadata card template
 *
 *
 * @param {string} id - The box request Id
 * @param {Object} type - The type of metadata card (status, transcript, etc.)
 * @param {Object} status - object with code and message
 * @returns {Object} An object with the correct metadata card template
 * , entries = null, duration = null
 */
const getMetadataCardTemplate = (type, title, skillName, boxId, status, entries, duration) => {
    // eslint-disable-next-line no-param-reassign
    status = status || {};

    const metadataCardTemplate = {
        created_at: new Date().toISOString(),
        type: SKILLS_METADATA_CARD_TYPE,
        skill_card_type: type,
        title,
        skill: {
            type: SKILLS_SERVICE_TYPE,
            id: skillName
        },
        invocation: {
            type: SKILLS_METADATA_INVOCATION_TYPE,
            id: boxId // box request id
        },
        status,
        skill_card_title: {
            code: `skills_${title.toLowerCase()}`,
            message: title
        }
    };
    if (entries) {
        metadataCardTemplate.entries = entries;
    }
    if (duration) {
        metadataCardTemplate.duration = duration;
    }
    return metadataCardTemplate;
};

const printFinished = (response) => {
    if(response){
        Logger.logDebug(`API Reponse Error: ${JSON.stringify(response, null, 2)}`);
    }
    else{
        Logger.logDebug('Skill Invocations API call succeeded');
    }
};
/**
 * General put call to the skills invocation API. This will add metadata cards to the file and log other values for analysis purposes
 *
 * API Endpoint: '/skill_invocations/:skillID'
 * Method: PUT
 *
 * @param {Object} body - The data to put
 * @param {Function} [callback] - Called with updated metadata if successful, optional
 * @returns {Promise<Object>} A promise resolving to the updated metadata
 */
SkillInvocations.prototype.putData = function(body, callback) {
    // eslint-disable-next-line no-param-reassign
    callback = callback || printFinished;
    const apiPath = urlPath(BASE_PATH, this.skillId);
    const params = {
        body,
        headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json'
        }
    };

    return this.client.wrapWithDefaultHandler(this.client.put)(apiPath, params, callback);
};

/**
 * This saves metadata for a file.
 *
 *
 * @param {string} skillId - Id of the skill
 * @param {Array<Object>} metadataCards - An array of metadata cards
 * @param {Function} callback - function that will be called after the metadata is saved, optional
 * @param {string} status - Status of the skill on this file.
 * @param {Object} usage - Usage for this skill, necessary parameter for success status only. Audio/Video SkillInvocations will use duration and seconds, Image skill will use file and 1, Document skills will use pages.
 * @returns {Promise<Object>} A promise resolving to the updated metadata
 */
SkillInvocations.prototype.saveMetadata = function(metadataCards, usage, status, callback) {
    // eslint-disable-next-line no-param-reassign
    usage = usage || {};
    // eslint-disable-next-line no-param-reassign
    status = status || 'success';
    const body = {
        status,
        file: {
            type: 'file',
            id: this.fileId
        },
        metadata: {
            cards: metadataCards
        },
        usage
    };
    return this.putData(body, callback);
};

/**
 * This saves an error metadata card for a file.
 *
 *
 * @param {string} failureType - 'transient_failure' or 'permanent_failure', see StatusEnum
 * @param {Function} callback - function that will be called after the error metadata is saved, optional
 * @param {string} errorCode - Code specifying the type of error that occured
 * @param {string} ErrorMessage - Message describing the error
 * @returns {Promise<Object>} A promise resolving to the updated error metadata
 */
SkillInvocations.prototype.saveErrorMetadata = function(failureType, errorCode, errorMessage, usage) {
    // eslint-disable-next-line no-param-reassign
    errorCode = errorCode || 'skills_unknown_error';
    // eslint-disable-next-line no-param-reassign
    errorMessage = errorMessage || 'Something went wrong with running this skill or fetching its data';

    const status = {
        code: errorCode,
        message: errorMessage
    };
    const errorCard = getMetadataCardTemplate('status', 'Error', this.skillName, this.boxId, status);
    errorCard.error = errorCode;
    return this.saveMetadata([errorCard], usage, failureType);
};

/**
 * This saves the status of a skill on a file
 *
 *
 * @param {string} status - status of the skill, see StatusEnum
 * @param {Function} callback - function that will be called after the error metadata is saved, optional
 * @param {Object} usage - Usage for this skill, necessary parameter for success status only. Audio/Video SkillInvocations will use duration and seconds, Image skill will use file and 1, Document skills will use pages.
 * @returns {Promise<Object>} A promise resolving to the updated status
 */
SkillInvocations.prototype.saveStatus = function(status, usage, callback) {
    const body = {
        status,
        file: {
            type: 'file',
            id: this.fileId
        },
        usage
    };
    return this.putData(body, callback);
};

/**
 * Returns an object with a transcript card template
 *
 *
 * @param {Array<Object>} transcriptData - An array of objects made up of transcript text and the start and stop values for when the words are spoken
 * @param {string} duration - duration of the video/audio file
 * @returns {Object} An object with the correct metadata card template for a transcript card.
 */
SkillInvocations.prototype.transcriptCardTemplate = function(transcriptData, duration) {
    return getMetadataCardTemplate(
        CARD_TYPE_TRANSCRIPT,
        CARD_TITLE_TRANSCRIPT,
        this.skillName,
        this.boxId,
        {},
        transcriptData,
        duration
    );
};

/**
 * Returns an object with a keyword card template
 *
 *
 * @param {Array<Object>} keywordData - An array of objects made up of keywords and the start and stop values for when the keywords are present
 * @param {string} duration - duration of the video/audio file
 * @returns {Object} An object with the correct metadata card template for a keyword card.
 */
SkillInvocations.prototype.keywordCardTemplate = function(keywordData, duration) {
    return getMetadataCardTemplate(
        CARD_TYPE_KEYWORD,
        CARD_TITLE_KEYWORD,
        this.skillName,
        this.boxId,
        {},
        keywordData,
        duration
    );
};

/**
 * Returns an object with a timeline card template
 *
 *
 * @param {Array<Object>} timeLineData - An array of objects made up of keywords and the start and stop values for when the keywords are present
 * @param {string} duration - duration of the video/audio file
 * @returns {Object} An object with the correct metadata card template for a timeline card.
 */
SkillInvocations.prototype.timeLineCardTemplate = function(facesData, duration) {
    return getMetadataCardTemplate(
        CARD_TYPE_TIMELINE,
        CARD_TITLE_TIMELINE,
        this.skillName,
        this.boxId,
        {},
        facesData,
        duration
    );
};

module.exports = {
    SkillInvocations,
    StatusEnum,
    UsageUnitEnum
};
