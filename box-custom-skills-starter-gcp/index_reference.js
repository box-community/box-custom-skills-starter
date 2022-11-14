'use strict';

const { FilesReader, SkillsWriter } = require('./skills-kit-2.0');
const Box = require("box-node-sdk");
const axios = require("axios");
const {DocumentProcessorServiceClient} = require('@google-cloud/documentai').v1;
const fs = require('fs');

//Environment variables
const boxPrimaryKey = process.env.box_primary_key;
const boxSecondaryKey = process.env.box_secondary_key;
const projectId = process.env.gcp_project_id;
const location = process.env.gcp_location; 
const processorId = process.env.gcp_processor_id;
const bedroomList = process.env.bedroom_list.split(",")
const box_api_endpoint = process.env.box_api_endpoint;
const metdataKey = process.env.box_metadata_key;


exports.boxSkill = async (request, response) => { 
    const headers = JSON.stringify(request.headers);
    console.log('Request Headers: ', headers);
    const body = JSON.stringify(request.body);
    console.log('Request Body: ', body);
    //Other variables
    //This sets the bedroom counter to zero
    let bedCounter = 0
    
    //Validate Box Signature Keys So Bad People Don't Use Your Endpoint
    let isValid = Box.validateWebhookMessage(request.body, request.headers, boxPrimaryKey, boxSecondaryKey);
    //If the caller is Box, Continue
    if(isValid){
        //Grabs the file information from the request body
        const filesReader = new FilesReader(request.body);
        //Use the skills kit to create a way to add metadata to the file
        const skillsWriter = new SkillsWriter(filesReader.getFileContext());
        try {
            //Google Process
            const textToProcess = await processDocument();

            //If Google found text, Continue
            if(textToProcess){
                //Count and create options for floorplan based on text from Google
                await processText(textToProcess);

                //Metadata Template Writing
                await skillsWriter.fileWriteClient.files.setMetadata(
                    skillsWriter.fileId,
                    skillsWriter.fileWriteClient.metadata.scopes.ENTERPRISE,
                    metdataKey,
                    { 
                        //The key on the left is from the metadata field setup in Box
                        //The keys are always camel case without spaces
                        //So a field name of Number of Bedrooms would have a key of numberOfBedrooms
                        bedrooms: bedCounter, 
                    }
                );
                
                console.log('Template Attached')
                response.status(200).send('Template Attached');
            } else {
                response.status(200).send('Something went wrong! See Logs');
            }

        } catch (error) {
            console.log("Error: ", JSON.stringify(error))
            response.status(200).send(JSON.stringify(error));
        }
    } else {
        console.log('Keys Were Not Valid')
        response.status(200).send('Keys Invalid');
    }
    
    //Send encoded file to document ai to process and return the text
    async function processDocument() {
        try {
            // Instantiates a client
            const client = new DocumentProcessorServiceClient();
            const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

            //Download the box file and encode it
            const boxFileEncoded = await downloadBoxFile();

            const request = {
                name,
                rawDocument: {
                    content: boxFileEncoded,
                    mimeType: 'application/pdf',
                },
            };

            // Recognizes text entities in the PDF document
            const [result] = await client.processDocument(request);
            const {document} = result;

            // Get all of the document text as one big string
            const {text} = document;

            // Extract shards from the text field
            const getText = textAnchor => {
                if (!textAnchor.textSegments || textAnchor.textSegments.length === 0) {
                        return '';
                }
    
                // First shard in document doesn't have startIndex property
                const startIndex = textAnchor.textSegments[0].startIndex || 0;
                const endIndex = textAnchor.textSegments[0].endIndex;
    
                return text.substring(startIndex, endIndex);
            };

            //Array to put all the text into
            const floorplanText = [];

            //Add text from each page to the array
            for (const page of document.pages) {
                const {paragraphs} = page;
                for (const paragraph of paragraphs) {
                    const paragraphText = getText(paragraph.layout.textAnchor);
                    floorplanText.push(paragraphText.replace(/[\n\r]/g,' '))
                }
            }
            console.log("Floor plan text added to array")
            return floorplanText
        }          
        catch (error) {
            console.log("Error:", JSON.stringify(error))
        }      
    }

    //Download file and encode it
    async function downloadBoxFile() {
        try {
            //Build the file download url so that we can locally download the file
            const fileDownloadURL = `${box_api_endpoint}/files/${request.body.source.id}/content?access_token=${request.body.token.read.access_token}`;

            //Download local file 
            const res = await axios.get(fileDownloadURL,{responseType: 'arraybuffer'});
            //Encode image for gcp document AI
            const encodedImage = Buffer.from(res.data, 'binary').toString('base64');

            return encodedImage
        } catch (error) {
            console.log(JSON.stringify(error))
        }
    }

    //Process the text to find the various data needed for metadata template
    async function processText(textToProcess){
        try {
            console.log('Processing Text: ', textToProcess.toString());

            //Loop through each item in the text to process array
            for (const room of textToProcess){
                bedCounter += await listIterator(bedroomList,room, 1)
            }

        } catch (error) {
            console.log(JSON.stringify(error));
        }
    }

    //Reusable method to iterate through the room names
    //Variables list: list of expected room, room: the room being search for, number: number to add to the counter for this room type
    async function listIterator (list, room, number){
        let counter = 0
        if (list.some(item => room.includes(item))) {
            counter += number
        }
        return counter
    }
    
};
