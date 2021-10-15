# Sample hello-world Skill on GCP

This is a sample hello-world nodejs skill designed to work on Goole Cloud Platform.

**Note: Make sure to change the project and the credentials keys in the serverless.yml to your own values.**

## Steps to Setup and Deploy

1. Install Node v10.0.0 or higher
2. [Set up Google Cloud Account](https://serverless.com/framework/docs/providers/google/guide/credentials/)
3. `npm install`
4. `sls deploy --project=box-shield-test --credentials=~/.gcloud/serverless.json`

## Monitoring health of your functions in GCP
Cloud Monitoring provides visibility into the performance, uptime, and overall health of cloud-powered applications. It collects metrics, events, and metadata from Google Cloud. There are couple of ways to monitor the health of your functions.
1. Create metrics dashboard in [Google Console](https://console.cloud.google.com/monitoring)
2. Setup Wavefront<->GCP integration, and bring in the metrics to Wavefront to create dashboards and alerts.

To setup integration between Wavefront and GCP:
1. visit [https://box.wavefront.com/integration/gcp/setup](https://box.wavefront.com/integration/gcp/setup).
2. If you have `integrations` or `proxies` permission, click on "ADD INTEGRATION" button and follow [this](https://docs.wavefront.com/gcp.html#google-cloud-platform-integration-1) guide.
3. If you don't have permission to add/enable new GCP integration, ask in #observability channel.

Once the integration between Wavefront & GCP is added, and required JSON key (service account key from GCP console) is uploaded to establish trust, the following metrics will start flowing:
1. `cloudfunctions.function.active_instances`
2. `cloudfunctions.function.execution_count_rate`
3. `cloudfunctions.function.execution_times`
4. `cloudfunctions.function.network_egress_rate`
5. `cloudfunctions.function.user_memory_bytes`

## Exporting Logging from GCP
1. Setup GCP pub/sub topic and subscriptions.
   1. [Using Console UI](https://cloud.google.com/pubsub/docs/quickstart-console)
   2. [Using Client Libraries](https://cloud.google.com/pubsub/docs/quickstart-client-libraries)
   3. [Using Command line](https://cloud.google.com/pubsub/docs/quickstart-cli)
2. Setup GCP log Sinks
   1. [Using Client Libraries](https://cloud.google.com/sdk/gcloud/reference/beta/logging/sinks/create)
   2. [Using Console UI](https://cloud.google.com/logging/docs/export/configure_export_v2#dest-create)
   3. [Using Command line](https://cloud.google.com/logging/docs/reference/tools/gcloud-logging#creating_sinks)
3. Use pcloud logworker to poll the topic/subscription you created in step 1.
   1. Check out the PCLOUD log worker [architecture](https://confluence.inside-box.net/pages/viewpage.action?spaceKey=ETO&title=PCloud%3A+Log+Workers+Architecture+Design).
   2. Clone the [logworker_gcp repo](https://git.dev.box.net/techops/logworker_gcp)
   3. Create logworker binary with or without container and execute it.
   4. The `gcpconfig.json` parameter passed to the logworker is the GCP service account key you can download from GCP console
   5. When the worker runs successfully, the GCP logs are fetched into the file mentioned in [gcpconfig.json](https://git.dev.box.net/techops/logworker_gcp/blob/master/configs/gcpconfig.json).
