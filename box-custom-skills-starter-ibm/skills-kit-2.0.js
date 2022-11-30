/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
/* eslint no-param-reassign: ["error", { "props": false }] */

/**
 * Copyright 2018 Box Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* External modules */
const BoxSDK = require('box-node-sdk');
const CustomStream = require('stream');
const urlPath = require('box-node-sdk/lib/util/url-path');
const urlTemplate = require('url-template');
const path = require('path');
const jimp = require('jimp');
const trimStart = require('lodash/trimStart');
const cloneDeep = require('lodash/cloneDeep');

/* Constant values for writing cards to skill_invocations service */
const BASE_PATH = '/skill_invocations'; // Base path for all files endpoints
const SKILLS_SERVICE_TYPE = 'service';
const SKILLS_METADATA_CARD_TYPE = 'skill_card';
const SKILLS_METADATA_INVOCATION_TYPE = 'skill_invocation';

const BOX_API_ENDPOINT = 'https://api.box.com/2.0';
const MB_INTO_BYTES = 1048576;
const FileType = {
    AUDIO: { name: 'AUDIO', representationType: '[mp3]' },
    VIDEO: { name: 'VIDEO', representationType: '[mp4]' },
    IMAGE: { name: 'IMAGE', representationType: '[jpg?dimensions=1024x1024]' },
    DOCUMENT: { name: 'DOCUMENT', representationType: '[extracted_text]' }
};

const boxVideoFormats = [
    '3g2',
    '3gp',
    'avi',
    'flv',
    'm2v',
    'm2ts',
    'm4v',
    'mkv',
    'mov',
    'mp4',
    'mpeg',
    'mpg',
    'ogg',
    'mts',
    'qt',
    'ts',
    'wmv'
];
const boxAudioFormats = ['aac', 'aif', 'aifc', 'aiff', 'amr', 'au', 'flac', 'm4a', 'mp3', 'ra', 'wav', 'wma'];
const boxImageFormats = [
    'ai',
    'bmp',
    'gif',
    'eps',
    'heic',
    'jpeg',
    'jpg',
    'png',
    'ps',
    'psd',
    'svg',
    'tif',
    'tiff',
    'dcm',
    'dicm',
    'dicom',
    'svs',
    'tga'
];

const getFileFormat = function getFileFormat(fileName) {
    const fileExtension = path.extname(fileName).toLowerCase();
    return trimStart(fileExtension, '.');
};
const getFileType = function getFileType(fileFormat) {
    if (boxAudioFormats.includes(fileFormat)) return FileType.AUDIO.name;
    else if (boxImageFormats.includes(fileFormat)) return FileType.IMAGE.name;
    else if (boxVideoFormats.includes(fileFormat)) return FileType.VIDEO.name;
    return FileType.DOCUMENT.name;
};

/** public enums */
const SkillsErrorEnum = {
    FILE_PROCESSING_ERROR: 'skills_file_processing_error',
    INVALID_FILE_SIZE: 'skills_invalid_file_size_error',
    INVALID_FILE_FORMAT: 'skills_invalid_file_format_error',
    INVALID_EVENT: 'skills_invalid_event_error',
    NO_INFO_FOUND: 'skills_no_info_found',
    INVOCATIONS_ERROR: 'skills_invocations_error',
    EXTERNAL_AUTH_ERROR: 'skills_external_auth_error',
    BILLING_ERROR: 'skills_billing_error',
    UNKNOWN: 'skills_unknown_error'
};

/**
 * FilesReader :- A helpful client to capture file related information from
 * incoming Box Skills event  and to access the file's content.
 *
 * API:-
 * FilesReader.getFileContext () : JSON
 * FilesReader.validateFormat (allowedFileFormatsList) : boolean
 * FilesReader.validateSize (allowedMegabytesNum) : boolean
 * async FilesReader.getContentBase64 () : string
 * FilesReader.getContentStream () : stream
 * async FilesReader.getBasicFormatFileURL () : string
 * async FilesReader.getBasicFormatContentBase64 () : string
 * FilesReader.getBasicFormatContentStream () : string
 *
 * Note: BasicFormat functions allows you to access your files stored in Box in
 * another format, which may be more accepted by ML providers. The provided basic
 * formats are Audio files→.mp3, Document/Image files→.jpeg . Video files→.mp4.
 * Caution should be applied using BasicFormats for certain large files as it
 * involves a time delay, and your skill code or skills-engine request may
 * time out before the converted format is fetched.
 */

function FilesReader(body) {
    const eventBody = typeof body === 'object' ? body : JSON.parse(body);
    this.requestId = eventBody.id;
    this.skillId = eventBody.skill.id.toString();
    this.fileId = eventBody.source.id;
    this.fileName = eventBody.source.name;
    this.fileSize = eventBody.source.size;
    this.fileFormat = getFileFormat(this.fileName);
    this.fileType = getFileType(this.fileFormat);
    this.fileReadToken = eventBody.token.read.access_token;
    this.fileWriteToken = eventBody.token.write.access_token;
    this.fileReadClient = BoxSDK.getBasicClient(this.fileReadToken);
    this.fileDownloadURL = `${BOX_API_ENDPOINT}/files/${this.fileId}/content?access_token=${this.fileReadToken}`;
}

/**
 * SkillsWriter :- A helpful class to write back Metadata Cards for
 * Topics, Transcripts, Timelines, Errors and Statuses back to Box for
 * any file for which a Skills Event is sent out.
 *
 * API:-
 * SkillsWriter.createTopicsCard ( topicsDataList, optionalFileDuration, optionalCardTitle ) : DataCard json
 * SkillsWriter.createTranscriptsCard ( transcriptsDataList, optionalFileDuration, optionalCardTitle ): DataCard json
 * async SkillsWriter.createFacesCard ( facesDataList, optionalFileDuration, optionalCardTitle ) : DataCard json
 * async SkillsWriter.saveProcessingCard ( optionalCallback ) : null
 * async SkillsWriter.saveErrorCard ( error, optionalCustomMessage, optionalCallback ): null
 * async SkillsWriter.saveDataCards ( listofDataCardJSONs, optionalCallback): null
 */
function SkillsWriter(fileContext) {
    this.requestId = fileContext.requestId;
    this.skillId = fileContext.skillId;
    this.fileId = fileContext.fileId;
    this.fileWriteClient = BoxSDK.getBasicClient(fileContext.fileWriteToken);
}

/** FilesReader private functions */

/**
 * reads a ReadStream into a buffer that it then converts to a string
 * @param  {Object} stream - read stream
 * @return Promise - resolves to the string of information read from the stream
 */
const readStreamToString = function readStreamToString(stream, encoding = 'base64') {
    if (!stream || typeof stream !== 'object') {
        throw new TypeError('Invalid Stream, must be a readable stream.');
    }
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => {
            chunks.push(chunk);
        });
        stream.on('error', (err) => {
            reject(err);
        });
        stream.on('end', () => {
            resolve(Buffer.concat(chunks).toString(encoding));
        });
    });
};

/**
 * Poll the representation info URL until representation is generated,
 * then return content URL template.
 * @param {BoxClient} client The client to use for making API calls
 * @param {string} infoURL The URL to use for getting representation info
 * @returns {Promise<string>} A promise resolving to the content URL template
 */
function pollRepresentationInfo(client, infoURL) {
    return client.get(infoURL).then((response) => {
        if (response.statusCode !== 200) {
            console.error(`Unexpected response ${response}`);
        }
        const info = response.body;
        switch (info.status.state) {
            case 'success':
            case 'viewable':
            case 'error':
                return info;
            case 'none':
            case 'pending':
                return Promise.delay(1000).then(() => pollRepresentationInfo(client, infoURL));
            default:
                console.error(`Unknown representation status: ${info.status.state}`);
                throw new Error(SkillsErrorEnum.FILE_PROCESSING_ERROR);
        }
    });
}

/** FilesReader public functions */

/**
 * Returns a JSON containing fileId, fileName, fileFormat, fileType, fileSize, fileDownloadURL,
 * fileReadToken, fileWriteToken, skillId, requestId for use in code.
 */
FilesReader.prototype.getFileContext = function getFileContext() {
    return {
        requestId: this.requestId,
        skillId: this.skillId,
        fileId: this.fileId,
        fileName: this.fileName,
        fileSize: this.fileSize,
        fileFormat: this.fileFormat,
        fileType: this.fileType,
        fileDownloadURL: this.fileDownloadURL,
        fileReadToken: this.fileReadToken,
        fileWriteToken: this.fileWriteToken
    };
};

/**
 * Helper function to check if a given file is eligible to be processed by the
 * skill as per the list of allowed formats.
 */
FilesReader.prototype.validateFormat = function validateFormat(allowedFileFormatsList) {
    if (allowedFileFormatsList.includes(this.fileFormat)) return true;
    console.error(`File format ${this.fileFormat} is not accepted by this skill`);
    throw new Error(SkillsErrorEnum.INVALID_FILE_FORMAT);
};

/**
 * Helper function to check if a given file is eligible to be processed by the skill as per the size limit.
 */
FilesReader.prototype.validateSize = function validateSize(allowedMegabytesNum) {
    const fileSizeMB = this.fileSize / MB_INTO_BYTES;
    if (fileSizeMB <= allowedMegabytesNum) return true;
    console.error(`File size ${fileSizeMB} MB is over accepted limit of ${allowedMegabytesNum} MB`);
    throw new Error(SkillsErrorEnum.INVALID_FILE_SIZE);
};

/**
 * Returns a Read Stream to be passed to read file directly from box. Note:
 * Some ML providers support passing file read streams.
 */
FilesReader.prototype.getContentStream = function getContentStream() {
    // Pipe to in-memory stream, since Box stream in some cases is not allowed.
    const bufferStream = new CustomStream.PassThrough();
    return this.fileReadClient.files.getReadStream(this.fileId, null, (stream) => stream.pipe(bufferStream));
};

/* Outputs the entire file in base64 format. Note: some ML providers have a limit to how
 * large of the payload size can you pass over REST calls. For them pass them readStream instead
 */
FilesReader.prototype.getContentBase64 = function getContentBase64() {
    return this.getContentStream().then((stream) => readStreamToString(stream));
};

/* Outputs the entire file in binary format. Note: some ML providers have a limit to how
 * large of the payload size can you pass over REST calls. For them pass them readStream instead
 */
FilesReader.prototype.getContentBinary = function getContentBinary() {
    return this.getContentStream().then((stream) => readStreamToString(stream, 'binary'));
};

/**
 * Same as FilesReader.getFileContext().fileDownloadURL but in BasicFormat
 */
FilesReader.prototype.getBasicFormatFileURL = function getBasicFormatFileURL() {
    const options = { assetPath: '' };

    return this.fileReadClient.files
        .getRepresentationInfo(this.fileId, FileType[this.fileType].representationType)
        .then((reps) => {
            const repInfo = reps.entries.pop();
            if (!repInfo) {
                console.error('Could not get information for requested representation');
                throw new Error(SkillsErrorEnum.FILE_PROCESSING_ERROR);
            }

            switch (repInfo.status.state) {
                case 'success':
                case 'viewable':
                    return repInfo.content.url_template;
                case 'error':
                    console.error('Representation had error status');
                    throw new Error(SkillsErrorEnum.FILE_PROCESSING_ERROR);
                case 'none':
                case 'pending':
                    return pollRepresentationInfo(this.fileReadClient, repInfo.info.url).then((info) => {
                        if (info.status.state === 'error') {
                            console.error('Representation had error status');
                            throw new Error(SkillsErrorEnum.FILE_PROCESSING_ERROR);
                        }
                        return info.content.url_template;
                    });
                default:
                    console.error(`Unknown representation status: ${repInfo.status.state}`);
                    throw new Error(SkillsErrorEnum.FILE_PROCESSING_ERROR);
            }
        })
        .then(
            (assetURLTemplate) =>
                `${urlTemplate.parse(assetURLTemplate).expand({ asset_path: options.assetPath })}?access_token=${
                    this.fileReadToken
                }`
        );
};

/**
 * Same as FilesReader.getFileContext().getContentStream() but in BasicFormat
 */
FilesReader.prototype.getBasicFormatContentStream = function getBasicFormatContentStream() {
    // Pipe to in-memory stream, since Box stream in some cases is not allowed.
    const bufferStream = new CustomStream.PassThrough();
    return this.fileReadClient.files
        .getRepresentationContent(this.fileId, FileType[this.fileType].representationType, null, (stream) =>
            stream.pipe(bufferStream)
        )
        .catch((e) => {
            if (e.statusCode === 401) {
                throw new TypeError(
                    'The client provided is unauthorized. Client should have read access to the file passed'
                );
            }
            throw e;
        });
};

/*
 * Same as FilesReader.getFileContext().getContentBase64() but in BasicFormat
 */
FilesReader.prototype.getBasicFormatContentBase64 = function getBasicFormatContentBase64() {
    return this.getBasicFormatContentStream().then((stream) => readStreamToString(stream));
};

/*
 * Same as FilesReader.getFileContext().getContentBinary() but in BasicFormat
 */
FilesReader.prototype.getBasicFormatContentBinary = function getBasicFormatContentBinary() {
    return this.getBasicFormatContentStream().then((stream) => readStreamToString(stream, 'binary'));
};

/** SkillsWriter private enums */
const cardType = {
    TRANSCRIPT: 'transcript',
    TOPIC: 'keyword',
    FACES: 'timeline',
    STATUS: 'status',
    ERROR: 'error'
};

const cardTitle = {
    TRANSCRIPT: 'Transcript',
    TOPIC: 'Topics',
    FACES: 'Faces',
    STATUS: 'Status',
    ERROR: 'Error'
};

const usageUnit = {
    FILES: 'files',
    SECONDS: 'seconds',
    PAGES: 'pages',
    WORDS: 'words'
};

const skillInvocationStatus = {
    INVOKED: 'invoked',
    PROCESSING: 'processing',
    PENDING: 'skills_pending_status',
    TRANSIENT_FAILURE: 'transient_failure',
    PERMANENT_FAILURE: 'permanent_failure',
    SUCCESS: 'success'
};

/** SkillsWriter private functions */

/**
 * validates if Enum value passed exists in the enums
 */
const validateEnum = function validateEnum(inputValue, enumName) {
    return Object.values(enumName).includes(inputValue);
};

/**
 * Validates if usage object is of allowed format: { unit: <usageUnit>, value: <Integer> }
 */
const validateUsage = function validateUsage(usage) {
    return usage && validateEnum(usage.unit, usageUnit) && Number.isInteger(usage.value);
};

/**
 * Private function to validate and update card template data to have expected fields
 */
const processDataList = function processDataList(dataList, duration) {
    return dataList
        .filter((data) => data.text && data.text.trim())
        .map((data) => {
            if (duration && !(Array.isArray(data.appears) || data.appears.length)) {
                console.warn(
                    `Missing optional 'appears' field in ${JSON.stringify(
                        data
                    )} which is list of 'start' and 'end' fields`
                );
            }
            const cardDataCopy = cloneDeep(data);
            cardDataCopy.type = typeof data.image_url === 'string' ? 'image' : 'text';
            cardDataCopy.text = data.text.trim();
            return cardDataCopy;
        });
};

/**
 * Private function, for underlying call to saving data to skills invocation api
 * Will add metadata cards to the file and log other values for analysis purposes
 *
 * API Endpoint: '/skill_invocations/:skillID'
 * Method: PUT
 *
 * @param {BoxSDK} client       Box SDK client to call skill invocations apiId
 * @param {string} skillId      id of the skill for the '/skill_invocations/:skillID' call
 * @param {Object} body         data to put
 * @param {Function} callback   (optional) called with updated metadata if successful
 * @return {Promise<Object>}    promise resolving to the updated metadata
 */
const putData = function putData(client, skillId, body, callback) {
    const apiPath = urlPath(BASE_PATH, skillId);
    const params = {
        body,
        headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json'
        }
    };
    return client.wrapWithDefaultHandler(client.put)(apiPath, params, callback);
};

/** SkillsWriter public functions */

/**
 * Public function to return a complete metadata card
 *
 * @param {string} type         type of metadata card (status, transcript, etc.)
 * @param {string} title        title of metadata card (Status, Transcript, etc.)
 * @param {Object} optionalEntries      (optional) list of cards being saved
 * @param {number} optionalFileDuration (optional) total duration of file in seconds
 * @param {Object} optionalStatus       (optional) status object with code and message
 * @return {Object} metadata card template
 */
SkillsWriter.prototype.createMetadataCard = function createMetadataCard(
    type,
    title,
    optionalStatus = {},
    optionalEntries,
    optionalfileDuration
) {
    const titleCode = `skills_${title.toLowerCase()}`.replace(' ', '_');
    const template = {
        created_at: new Date().toISOString(),
        type: SKILLS_METADATA_CARD_TYPE,
        skill: { type: SKILLS_SERVICE_TYPE, id: this.skillId },
        skill_card_type: type,
        skill_card_title: { code: titleCode, message: title },
        invocation: { type: SKILLS_METADATA_INVOCATION_TYPE, id: this.requestId },
        status: optionalStatus
    };
    if (optionalEntries) {
        template.entries = optionalEntries;
    }
    if (optionalfileDuration) {
        template.duration = parseFloat(optionalfileDuration);
    }
    return template;
};

SkillsWriter.prototype.createTopicsCard = function createTopicsCard(
    topicsDataList,
    optionalFileDuration,
    optionalCardTitle
) {
    return this.createMetadataCard(
        cardType.TOPIC,
        optionalCardTitle || cardTitle.TOPIC,
        undefined,
        processDataList(topicsDataList),
        optionalFileDuration
    );
};

SkillsWriter.prototype.createTranscriptsCard = function createTranscriptsCard(
    transcriptsDataList,
    optionalFileDuration,
    optionalCardTitle
) {
    return this.createMetadataCard(
        cardType.TRANSCRIPT,
        optionalCardTitle || cardTitle.TRANSCRIPT,
        undefined,
        processDataList(transcriptsDataList),
        optionalFileDuration
    );
};

SkillsWriter.prototype.createFacesCard = function createFacesCard(
    facesDataList,
    optionalFileDuration,
    optionalCardTitle
) {
    const facesDataListProcessed = processDataList(facesDataList);
    const cards = this.createMetadataCard(
        cardType.FACES,
        optionalCardTitle || cardTitle.FACES,
        undefined,
        facesDataListProcessed,
        optionalFileDuration
    );

    // resize the image to be thumbnail size
    const dataURIPromises = [];
    Object.entries(facesDataListProcessed).forEach((faceData) =>
        dataURIPromises.push(
            jimp
                .read(faceData.image_url)
                .then((image) => image.resize(45, 45).getBase64Async(jimp.MIME_PNG))
                .catch(() => undefined) // dont throw error if any one image fails, so that Promise.all procceeds to resolving all inages
        )
    );

    // assign back each resolved and downsized image back to facesData
    return Promise.all(dataURIPromises).then((dataURIs) => {
        for (let i = 0; i < facesDataListProcessed.length; i++) {
            facesDataListProcessed[i].image_url = dataURIs[i] || facesDataListProcessed[i].image_url;
        }
        return cards;
    });
};

/**
 * Shows UI card with message: "We're preparing to process your file. Please hold on!".
 * This is used for temporarily letting your users know that your skill is under progress.
 * You can pass an optionalCallback function to print or log success in your code once the
 * card has been saved.
 */
SkillsWriter.prototype.saveProcessingCard = function saveProcessingCard(optionalCallback) {
    const status = {
        code: skillInvocationStatus.PENDING,
        message:
            "We're preparing to process your file. Please hold on!" /* eslint quotes: ["error", "single", { "avoidEscape": true }] */
    };
    const statusCard = this.createMetadataCard(cardType.STATUS, cardTitle.STATUS, status);
    return this.saveDataCards([statusCard], optionalCallback, skillInvocationStatus.PROCESSING);
};

/**
 *  Show UI card with error message. See Table: ErrorCode Enum for potential errorCode values,
 *  to notify user if any kind of failure occurs while running your skills code. Shows card as
 *  per the default message with each code, unless 'optionMessage' is provided. You can pass an
 *  optionalCallback function to print or log success in your code once the card has been saved.
 */
SkillsWriter.prototype.saveErrorCard = function saveErrorCard(
    error,
    optionalCustomErrorMessage,
    optionalCallback,
    optionalFailureType
) {
    const failureType =
        optionalFailureType === skillInvocationStatus.TRANSIENT_FAILURE
            ? optionalFailureType
            : skillInvocationStatus.PERMANENT_FAILURE;
    const errorCode = validateEnum(error, SkillsErrorEnum) ? error : SkillsErrorEnum.UNKNOWN;
    let errorObj = { code: errorCode };
    if (optionalCustomErrorMessage) {
        errorObj = { code: 'custom_error', message: optionalCustomErrorMessage };
    }
    const errorCard = this.createMetadataCard(cardType.STATUS, cardTitle.ERROR, errorObj);
    return this.saveDataCards([errorCard], optionalCallback, failureType);
};

/**
 * Shows all the cards passed in listofDataCardJSONs which can be of formatted as Topics,Transcripts
 * or Faces. Will override any existing pending or error status cards in the UI for that file version.
 */
const DEFAULT_USAGE = { unit: usageUnit.FILES, value: 1 };
SkillsWriter.prototype.saveDataCards = function saveDataCards(
    listofDataCardJSONs,
    optionalCallback,
    optionalStatus,
    optionalUsage
) {
    const status = validateEnum(optionalStatus, skillInvocationStatus) ? optionalStatus : skillInvocationStatus.SUCCESS;
    let usage = null;
    if (status === skillInvocationStatus.SUCCESS) {
        usage = validateUsage(optionalUsage) ? optionalUsage : DEFAULT_USAGE;
    }
    // create skill_invocations body
    const body = {
        status,
        file: {
            type: 'file',
            id: this.fileId
        },
        metadata: {
            cards: listofDataCardJSONs
        },
        usage
    };
    return putData(this.fileWriteClient, this.skillId, body, optionalCallback);
};

/* Exporting useful functions and enums from skills-kit plugin */
module.exports = {
    FilesReader,
    SkillsWriter,
    SkillsErrorEnum
};
