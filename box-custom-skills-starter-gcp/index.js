'use strict';

const { FilesReader, SkillsWriter } = require('./skills-kit-2.0');
const Box = require("box-node-sdk");

//environment variables
const boxPrimaryKey = process.env.box_primary_key;
const boxSecondaryKey = process.env.box_secondary_key;

exports.boxSkill = async (request, response) => {    
    const body = JSON.stringify(request.body);
    console.log('Request Body: ', body);
    
    //Validate Bpx Signature Keys So Bad People Don't Use Your Endpoint
    let isValid = Box.validateWebhookMessage(request.body, request.headers, boxPrimaryKey, boxSecondaryKey);

    if(isValid){
        const filesReader = new FilesReader(request.body);
        const skillsWriter = new SkillsWriter(filesReader.getFileContext());
        
        try{
            //Example custom metadata template added to file
            await skillsWriter.fileWriteClient.files.addMetadata(
                skillsWriter.fileId,
                skillsWriter.fileWriteClient.metadata.scopes.GLOBAL,
                'properties',
                { skillMessage: 'Hello World!' }
            );
            response.status(200).send('Hello World');
        } catch (error) {
            console.log("Error:", JSON.stringify(error))
            response.status(200).send(error);
        }
    } else {
        console.log('Keys Were Not Valid')
        response.status(200).send('Keys Invalid');
    }
};
