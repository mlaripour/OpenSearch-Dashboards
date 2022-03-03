/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Modifications Copyright OpenSearch Contributors. See
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
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { SB_SOURCE_PANEL } from '../utils/storybook';

export default {
  title: 'Test Cases',
  parameters: {
    options: { selectedPanel: SB_SOURCE_PANEL },
  },
};

export { Example as noSeries } from './1_no_series';
export { Example as chromePathBugFix } from './2_chrome_path_bug_fix';
export { Example as noAxesAnnotationBugFix } from './3_no_axes_annotation';
export { Example as filterZerosInLogFitDomain } from './4_filter_zero_values_log';
export { Example as legendScrollBarSizing } from './5_legend_scroll_bar_sizing';
export { Example as accessibilityCustomizations } from './6_a11y_custom_description';
