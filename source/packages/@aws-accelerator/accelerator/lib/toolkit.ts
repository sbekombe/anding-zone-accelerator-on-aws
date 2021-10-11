/**
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { SdkProvider } from 'aws-cdk/lib/api/aws-auth';
import { Bootstrapper, BootstrapSource } from 'aws-cdk/lib/api/bootstrap';
import { CloudFormationDeployments } from 'aws-cdk/lib/api/cloudformation-deployments';
import { StackSelector } from 'aws-cdk/lib/api/cxapp/cloud-assembly';
import { CloudExecutable } from 'aws-cdk/lib/api/cxapp/cloud-executable';
import { execProgram } from 'aws-cdk/lib/api/cxapp/exec';
import { ToolkitInfo } from 'aws-cdk/lib/api/toolkit-info';
import { CdkToolkit } from 'aws-cdk/lib/cdk-toolkit';
import { Command, Configuration } from 'aws-cdk/lib/settings';
import console from 'console';
import path from 'path';

/**
 *
 */
export enum AcceleratorToolkitCommand {
  BOOTSTRAP = Command.BOOTSTRAP,
  DEPLOY = Command.DEPLOY,
  DESTROY = Command.DESTROY,
  LIST = Command.LIST,
  LS = Command.LS,
  SYNTH = Command.SYNTH,
  SYNTHESIZE = Command.SYNTHESIZE,
}

/**
 * Wrapper around the CdkToolkit. The Accelerator defines this wrapper to add
 * the following functionality:
 *
 * - x
 * - y
 * - z
 */
export class AcceleratorToolkit {
  /**
   *
   * @returns
   */
  static isSupportedCommand(command: string): boolean {
    return Object.values(AcceleratorToolkitCommand).includes(command);
  }

  /**
   * Accelerator customized execution of the CDKToolkit based on
   * aws-cdk/packages/aws-cdk/bin/cdk.ts
   *
   *
   * @param command
   * @param account
   * @param region
   * @param stage
   *
   * @return Promise<void>
   *
   * @see aws-cdk/packages/aws-cdk/bin/cdk.ts
   */
  static async execute(
    command: string,
    account: string,
    region: string,
    stage: string,
    configDirPath: string,
  ): Promise<void> {
    console.log(`Executing cdk ${command} for aws://${account}/${region}`);

    const configuration = new Configuration({
      commandLineArguments: {
        _: [command as Command, ...[]],
        versionReporting: false,
        pathMetadata: false,
        output: path.join('cdk.out', account, region),
        assetMetadata: false,
        staging: false,
        lookups: false,
        context: [`account=${account}`, `region=${region}`, `stage=${stage}`, `config-dir=${configDirPath}`],
      },
    });
    await configuration.load();

    const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
      profile: configuration.settings.get(['profile']),
    });

    const cloudFormation = new CloudFormationDeployments({ sdkProvider });

    const cloudExecutable = new CloudExecutable({
      configuration,
      sdkProvider,
      synthesizer: execProgram,
    });

    const toolkitStackName: string = ToolkitInfo.determineName(configuration.settings.get(['toolkitStackName']));

    const cli = new CdkToolkit({
      cloudExecutable,
      cloudFormation,
      configuration,
      sdkProvider,
    });

    const selector: StackSelector = {
      patterns: [],
    };

    switch (command) {
      case Command.BOOTSTRAP:
        const source: BootstrapSource = { source: 'default' };
        const bootstrapper = new Bootstrapper(source);
        const environments = [`aws://${account}/${region}`];
        await cli.bootstrap(environments, bootstrapper, {
          toolkitStackName,
          parameters: {
            bucketName: configuration.settings.get(['toolkitBucket', 'bucketName']),
            kmsKeyId: configuration.settings.get(['toolkitBucket', 'kmsKeyId']),
          },
        });
        break;
      case Command.DEPLOY:
        await cli.deploy({
          selector,
          toolkitStackName,
        });
        break;
      case Command.DESTROY:
        await cli.destroy({
          selector,
          exclusively: false,
          force: true,
        });
        break;
      case Command.LIST:
      case Command.LS:
        await cli.list([], { long: false });
        break;
      case Command.SYNTHESIZE:
      case Command.SYNTH:
        await cli.synth([], false, true);
        break;
      default:
        throw new Error(`Unsupported command: ${command}`);
    }
  }
}