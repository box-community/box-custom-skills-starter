/**
 * @fileoverview Intrisic is a security feature available to internal Box Skills Developer to sandbox the lambda function.
 * The policies are written as whitelists (i.e., they're default-deny), for drastically reducing the attack surface of the skill code.
 * This preventive approach protects against exploitation of future bugs and malicious code.
 * Policies are used to restrict filesystem usage, restrict which URLs outbound HTTP calls can be made to,
 * and restrict which child processes are allowed to be spawned.
 */

/**
 * Module dependency limited to intrisic.
 * Intrinsic loaded first covers any other code imported henceforth
 */
const IntrinsicLambda = require('@intrinsic/lambda');

/**
 * Developers will need to add more policy whitelists as per their use case;
 * such as for calling ML provider or reading file from Box
 */
module.exports = new IntrinsicLambda()
    .enableMonitorMode() // Remove this for hardblocking policy violations
    .configurePolicies((policy) => {
        policy.fs.allowRead('/var/task/node_modules/**/*'); // enable reading install time npm modules

        // whitelist for saving and updating metadata to box
        policy.outboundHttp.allowPost('https://api.box.com/2.0/files/*/metadata/global/boxSkillsCards');
        policy.outboundHttp.allowPut('https://api.box.com/2.0/files/*/metadata/global/boxSkillsCards');
        policy.outboundHttp.allowPut('https://api.box.com/2.0/skill_invocations/**');
        policy.outboundHttp.allowGet('https://pbs.twimg.com/profile_images/885529357904510976/tM0vLiYS_400x400.jpg');
    })
    .setHandlerFile(`${__dirname}/index.js`) // bind to main skill function
    .setHandlerName('handler') // keeps same name for intrinic lambda handler as in index.js
    .run();
