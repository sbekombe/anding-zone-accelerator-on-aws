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

import * as cdk from 'aws-cdk-lib';
import { v4 as uuidv4 } from 'uuid';
import { Construct } from 'constructs';

const path = require('path');

/**
 * Initialized SecurityHubOrganizationalAdminAccountProps properties
 */
export interface SecurityHubOrganizationalAdminAccountProps {
  readonly region: string;
  readonly adminAccountId: string;
}

/**
 * Class - SecurityHubOrganizationAdminAccount
 */
export class SecurityHubOrganizationAdminAccount extends Construct {
  public readonly id: string;

  constructor(scope: Construct, id: string, props: SecurityHubOrganizationalAdminAccountProps) {
    super(scope, id);

    const SECURITYHUB_RESOURCE_TYPE = 'Custom::SecurityHubEnableOrganizationAdminAccount';

    const enableOrganizationAdminAccountFunction = cdk.CustomResourceProvider.getOrCreateProvider(
      this,
      SECURITYHUB_RESOURCE_TYPE,
      {
        codeDirectory: path.join(__dirname, 'enable-organization-admin-account/dist'),
        runtime: cdk.CustomResourceProviderRuntime.NODEJS_14_X,
        policyStatements: [
          {
            Sid: 'SecurityHubEnableOrganizationAdminAccountTaskOrganizationActions',
            Effect: 'Allow',
            Action: ['organizations:ListAccounts', 'organizations:DescribeOrganization'],
            Resource: '*',
          },
          {
            Effect: 'Allow',
            Action: 'organizations:EnableAWSServiceAccess',
            Resource: '*',
            Condition: {
              StringEquals: {
                'organizations:ServicePrincipal': 'securityhub.amazonaws.com',
              },
            },
          },
          {
            Effect: 'Allow',
            Action: ['organizations:RegisterDelegatedAdministrator', 'organizations:DeregisterDelegatedAdministrator'],
            Resource: `arn:${cdk.Stack.of(this).partition}:organizations::*:account/o-*/*`,
            Condition: {
              StringEquals: {
                'organizations:ServicePrincipal': 'securityhub.amazonaws.com',
              },
            },
          },
          {
            Sid: 'SecurityHubCreateMembersTaskIamAction',
            Effect: 'Allow',
            Action: ['iam:CreateServiceLinkedRole'],
            Resource: '*',
            Condition: {
              StringLike: {
                'iam:AWSServiceName': ['securityhub.amazonaws.com'],
              },
            },
          },
          {
            Sid: 'SecurityHubEnableOrganizationAdminAccountTaskSecurityHubActions',
            Effect: 'Allow',
            Action: [
              'securityhub:DisableOrganizationAdminAccount',
              'securityhub:EnableOrganizationAdminAccount',
              'securityhub:EnableSecurityHub',
              'securityhub:ListOrganizationAdminAccounts',
            ],
            Resource: '*',
          },
        ],
      },
    );

    const resource = new cdk.CustomResource(this, 'Resource', {
      resourceType: SECURITYHUB_RESOURCE_TYPE,
      serviceToken: enableOrganizationAdminAccountFunction.serviceToken,
      properties: {
        region: props.region,
        adminAccountId: props.adminAccountId,
        uuid: uuidv4(), // Generates a new UUID to force the resource to update
      },
    });

    this.id = resource.ref;
  }
}
