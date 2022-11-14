# Sample hello-world Skill on GCP

This is a sample hello-world nodejs Box Skill designed to work on Goole Cloud Platform.

**Note: You will need to add a gcp crendentials file and update the serverless.yml with that appropriate connection information.**

## Steps to Setup and Deploy

1. Install Node v10.0.0 or higher
2. [Set up a Google Cloud Account](https://serverless.com/framework/docs/providers/google/guide/credentials/)
3. Download the code.
4. Add your google keyfile to the .gcloud folder and name is serverless.json.
5. Update any connection and configuration information in the serverless.yml and package.json files. 
6. `npm install`
7. `sls deploy`
8. Once the deploy is complete, copy the invocation URL and paste it into the Box Skill configuration section.

**In order to allow Box to call the serverless function, you need to add permissions for allUsers to the serverless function for the Cloud Functions Invoker role.** 
