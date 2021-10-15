# Sample hello-world Skill on GCP

This is a sample hello-world nodejs skill designed to work on Goole Cloud Platform.

**Note: You will need to add a gcp crendentials file and update the serverless.yml with that appropriate connection information.**

## Steps to Setup and Deploy

1. Install Node v10.0.0 or higher
2. [Set up Google Cloud Account](https://serverless.com/framework/docs/providers/google/guide/credentials/)
3. Download the code.
4. Updates connection and configuration information in the serverless.yml and package.json files. 
5. `npm install`
6. `sls deploy --project=box-custom-skills-starter-gcp --credentials=~/credentials/serverless.json`
