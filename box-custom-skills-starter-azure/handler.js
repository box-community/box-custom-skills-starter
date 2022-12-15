'use strict';

// Import FilesReader and SkillsWriter classes from skills-kit-2.0.js library
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('./skills-kit-2.0');
const Box = require('box-node-sdk');

module.exports.boxSkill = async function boxSkill(context, req) {
    //const res = {};
    const filesReader = new FilesReader(req.body);
    const skillsWriter = new SkillsWriter(filesReader.getFileContext()); 
    try {
        //Validate Bpx Signature Keys So Bad People Don't Use Your Endpoint
        let isValid = Box.validateWebhookMessage(req.body, req.headers, process.env['box_primary_key'], process.env['box_secondary_key']);
        if (isValid) {
            const body = JSON.stringify(req.body);
            context.log('Request Body: ', body);
               
            // THE BELOW CODE IS COMMENTED OUT BUT CAN BE USED INSTEAD OF OR IN CONJUCTION WITH METADATA CARD CODE BELOW

            //SKILLS CARDS EXAMPLES
            //You can use this code to save a temporary processing skills card if using the skills card option
            //await skillsWriter.saveProcessingCard();

            //DO MACHINE LEARNING THINGS HERE 
    
            //const mockListOfDiscoveredKeywords = [{ text: 'file' }, { text: 'associated' }, { text: 'keywords' }];
            //const mockListOfDiscoveredTranscripts = [{ text: `This is a sentence/transcript card` }];
            // const mockListOfDiscoveredFaceWithPublicImageURI = [
            //     {
            //         image_url: 'https://seeklogo.com/images/B/box-logo-646A3D8C91-seeklogo.com.png',
            //         text: `Image hover/placeholder text if image doesn't load`
            //     }
            // ];
            // const mockListOfTranscriptsWithAppearsAtForPlaybackFiles = [
            //     {
            //         text: 'Timeline data can be shown in any card type',
            //         appears: [{ start: 1, end: 2 }]
            //     },
            //     {
            //         text: "Just add 'appears' field besides any 'text', with start and end values in seconds",
            //         appears: [{ start: 3, end: 4 }]
            //     }
            // ];
    
            // Turn your data into correctly formatted card jsons using SkillsWriter.
            // The cards will appear in UI in same order as they are passed in a list.
            //const cards = [];
            //cards.push(await skillsWriter.createFacesCard(mockListOfDiscoveredFaceWithPublicImageURI, null, 'Icons')); // changing card title to non-default 'Icons'.
            //cards.push(skillsWriter.createTopicsCard(mockListOfDiscoveredKeywords));
            // cards.push(skillsWriter.createTranscriptsCard(mockListOfDiscoveredTranscripts));
            // cards.push(skillsWriter.createTranscriptsCard(mockListOfTranscriptsWithAppearsAtForPlaybackFiles, 5)); // for timeline total playtime seconds of file also needs to be passed.
    
            // Save the cards to Box in a single calls to show in UI.
            // Incase the skill is invoked on a new version upload of the same file,
            // this call will override any existing skills cards, data or error, on Box file preview.
            // context.log(`cards ${JSON.stringify(cards)}`);
            //await skillsWriter.saveDataCards(cards);

            //Example custom metadata template added to file
            await skillsWriter.fileWriteClient.files.setMetadata(
                skillsWriter.fileId,
                skillsWriter.fileWriteClient.metadata.scopes.GLOBAL,
                'properties',
                { skillMessage: 'Hello World!' }
            );

            context.log("Skill process completed.")
            // Skills engine requires a 200 response within 10 seconds of sending an event.
            context.res = {
                status: 200
            };
            context.done();
        } else {
            context.log('Keys Were Not Valid')
            context.res = {
                status: 401
            };
            context.done();
        }
    } catch (error) {
        await skillsWriter.saveErrorCard(SkillsErrorEnum.UNKNOWN,"Something went wrong. It will retry again in a few minutes.");
        context.error(
            `Skill processing failed for file: ${filesReader.getFileContext().fileId} with error: ${error.message}`
        );
        context.res = {
            status: 400
        };
        context.done();
    }

  };
