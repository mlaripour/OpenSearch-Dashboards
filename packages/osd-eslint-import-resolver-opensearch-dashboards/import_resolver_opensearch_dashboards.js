/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const { join, dirname, extname } = require('path');

const webpackResolver = require('eslint-import-resolver-webpack');
const nodeResolver = require('eslint-import-resolver-node');

const {
  getOpenSearchDashboardsPath,
  getProjectRoot,
  getWebpackConfig,
  isFile,
  getIsPathRequest,
  resolveWebpackAlias,
} = require('./lib');

// cache context, it shouldn't change
let context;
function initContext(file, config) {
  if (context) {
    return context;
  }

  const projectRoot = getProjectRoot(file, config);
  const opensearchDashboardsPath = getOpenSearchDashboardsPath(config, projectRoot);
  const webpackConfig = getWebpackConfig(opensearchDashboardsPath, projectRoot, config);
  const aliasEntries = Object.entries(webpackConfig.resolve.alias || {});

  context = {
    webpackConfig,
    aliasEntries,
  };

  return context;
}

function tryNodeResolver(importRequest, file, config) {
  return nodeResolver.resolve(
    importRequest,
    file,
    // we use Object.assign so that this file is compatible with slightly older
    // versions of node.js used by IDEs (eg. resolvers are run in the Electron
    // process in Atom)
    Object.assign({}, config, {
      extensions: ['.js', '.json', '.ts', '.tsx'],
      isFile,
    })
  );
}

exports.resolve = function resolveOpenSearchDashboardsPath(importRequest, file, config) {
  config = config || {};

  if (config.forceNode) {
    return tryNodeResolver(importRequest, file, config);
  }

  const { webpackConfig, aliasEntries } = initContext(file, config);
  let isPathRequest = getIsPathRequest(importRequest);

  // if the importRequest is not a path we might be able to map it to a path
  // by comparing it to the webpack aliases. If we can convert it to a path
  // without actually invoking the webpack resolver we can save a lot of time
  if (!isPathRequest) {
    const resolvedAlias = resolveWebpackAlias(importRequest, aliasEntries);
    if (resolvedAlias) {
      importRequest = resolvedAlias;
      isPathRequest = true;
    }
  }

  // if the importRequest is a path, and it has a file extension, then
  // we just resolve it. This is most helpful with relative imports for
  // .css and .html files because those don't work with the node resolver
  // and we can resolve them much quicker than webpack
  if (isPathRequest && extname(importRequest)) {
    const abs = join(dirname(file), importRequest);
    if (isFile(abs)) {
      return {
        found: true,
        path: abs,
      };
    }
  }

  const nodeResult = tryNodeResolver(importRequest, file, config);
  if (nodeResult && nodeResult.found) {
    return nodeResult;
  }

  return webpackResolver.resolve(importRequest, file, {
    config: webpackConfig,
  });
};

// use version 2 of the resolver interface, https://github.com/benmosher/eslint-plugin-import/blob/master/resolvers/README.md#interfaceversion--number
exports.interfaceVersion = 2;
