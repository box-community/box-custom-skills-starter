# Sample hello-world Skill on GCP

This is a sample hello-world nodejs Box Skill designed to work on Google Cloud Platform. You can also follow the [blog post](https://medium.com/box-developer-blog/box-skills-pieces-of-the-puzzle-tutorial-dbc2d28c403e) on Medium for step by step guideance. 

**Note: You will need to add a gcp crendentials file and update the serverless.yml with that appropriate connection information.**

You will need to set up a Box Skill in the Box Developer Console, as well as authorize the skill and configure a folder to watch for uploads. You can find out more about that process in our [developer documentation](https://developer.box.com/guides/applications/custom-skills/setup/). 

## Steps to Setup and Deploy

1. Install Node v10.0.0 or higher
2. [Set up a Google Cloud Account](https://serverless.com/framework/docs/providers/google/guide/credentials/)
3. Download the code.
4. Add your google keyfile to the .gcloud folder and name is serverless.json.
5. Update any connection and configuration information in the serverless.yml and package.json files. 
6. `npm install`
7. `sls deploy`
8. Once the deploy is complete, copy the invocation URL and paste it into the Box Skill configuration section. Click Save.
9. After deploying, in the GCP console, you'll need to allow public access to the function so Box can call it. Find your function in the GCP cloud functions dashboard. Under the permissions tab, grant access to `allUsers` with the `Cloud Functions Invoker` role. 

Now, if you upload a file to the folder configured for the Box Skill, you should see metadata attached, as well as logs under the logs tab in the function.
