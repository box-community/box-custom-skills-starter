'use strict';

const { FilesReader, SkillsWriter } = require('./skills-kit-2.0');

exports.helloWorld = async (request, response) => {
    const filesReader = new FilesReader(request.body);
    const skillsWriter = new SkillsWriter(filesReader.getFileContext());

    await skillsWriter.fileWriteClient.files.addMetadata(
        skillsWriter.fileId,
        skillsWriter.fileWriteClient.metadata.scopes.GLOBAL,
        'properties',
        { skillMessage: 'Hello World!' }
    );

    response.status(200).send('Hello World!');
};

