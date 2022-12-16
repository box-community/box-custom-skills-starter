# Sample hello-world Box Skill on Azure

This is a sample hello-world nodejs Box Skill designed to work on Azure.

You will need to set up a Box Skill in the Box Developer Console, as well as authorize the skill and configure a folder to watch for uploads. You can find out more about that process in our [developer documentation](https://developer.box.com/guides/applications/custom-skills/setup/). 

## Steps to Setup and Deploy

1. Install Node v14.0.0 or higher
2. Follow directions [here](https://www.serverless.com/framework/docs/providers/azure/guide/credentials) on signing up for an Azure account and configuring serverless to use the appropriate Azure credentials.
3. Download the code.
4. Update any connection and configuration information in the serverless.yml and package.json files. 
5. `npm install`
6. `sls deploy`
7. Once the deploy is complete, copy the invocation URL (you will need to add https:// to the beginning as azure doesn't return this after deployment is complete.) and paste it into the Box Skill configuration section. Click Save.

Now, if you upload a file to the folder configured for the Box Skill, you should see metadata attached, as well as logs under the code + test > logs tab in the function.