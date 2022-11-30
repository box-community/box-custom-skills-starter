'use strict';

// Import FilesReader and SkillsWriter classes from skills-kit-2.0.js library
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('./skills-kit-2.0');
const Box = require('box-node-sdk');

//environment variables
//const boxPrimaryKey = process.env.box_primary_key;
//const boxSecondaryKey = process.env.box_secondary_key;

module.exports.handler = async (event, context, callback) => {  
    // instantiate your two skill development helper tools
    const filesReader = new FilesReader(event.body);
    const skillsWriter = new SkillsWriter(filesReader.getFileContext());

    await skillsWriter.saveProcessingCard();

    const body = JSON.stringify(event.body);
    console.log('Event Body: ', body);
    
    //Validate Bpx Signature Keys So Bad People Don't Use Your Endpoint
    let isValid = Box.validateWebhookMessage(event.body, event.headers, boxPrimaryKey, boxSecondaryKey);

    if(isValid){
        
        try{
            //Example custom metadata template added to file
            await skillsWriter.fileWriteClient.files.addMetadata(
                skillsWriter.fileId,
                skillsWriter.fileWriteClient.metadata.scopes.GLOBAL,
                'properties',
                { skillMessage: 'Hello World!' }
            );
        } catch (error) {
            console.log("Error:", JSON.stringify(error))
        } finally {
            // Skills engine requires a 200 response within 10 seconds of sending an event.
            // Please see different code architecture configurations in git docs,
            // that you can apply to make sure your service always responds within time.
            callback(null, { statusCode: 200, body: 'Box event was processed by skill' });
        }
    } else {
        console.log('Keys Were Not Valid')
        response.status(200).send('Keys Invalid');
    }
};
