# Sample hello-world Skill on AWS

This is a sample hello-world nodejs Box Skill designed to work on Amazon Web Services.

You will need to set up a Box Skill in the Box Developer Console, as well as authorize the skill and configure a folder to watch for uploads. You can find out more about that process in our [developer documentation](https://developer.box.com/guides/applications/custom-skills/setup/). 

## Steps to Setup and Deploy

1. Install Node v14.0.0 or higher
2. Follow directions [here](https://www.serverless.com/framework/docs/providers/aws/guide/credentials) on signing up for an AWS account and configuring serverless to use the appropriate AWS credentials.
3. Download the code.
4. Update any connection and configuration information in the serverless.yml and package.json files. 
5. `npm install`
6. `sls deploy`
7. Once the deploy is complete, copy the invocation URL and paste it into the Box Skill configuration section. Click Save.

Now, if you upload a file to the folder configured for the Box Skill, you should see a 'Hello world' metadata card attached, as well as logs under the logs tab in the function. There is commented out code in the middle of the index file that can be used if you would rather use Box Skills cards instead of metadata.