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

import React from 'react';
import { i18n } from '@osd/i18n';
import { mapToLayerWithId } from './util';
import { createRegionMapVisualization } from './region_map_visualization';
import { RegionMapOptions } from './components/region_map_options';
import { truncatedColorSchemas } from '../../charts/public';
import { Schemas } from '../../vis_default_editor/public';
import { ORIGIN } from '../../maps_legacy/public';

export function createRegionMapTypeDefinition(dependencies) {
  const { uiSettings, regionmapsConfig, getServiceSettings, additionalOptions } = dependencies;
  const visualization = createRegionMapVisualization(dependencies);

  return {
    name: 'region_map',
    title: i18n.translate('regionMap.mapVis.regionMapTitle', { defaultMessage: 'Region Map' }),
    description: i18n.translate('regionMap.mapVis.regionMapDescription', {
      defaultMessage:
        'Show metrics on a thematic map. Use one of the \
provided base maps, or add your own. Darker colors represent higher values.',
    }),
    icon: 'visMapRegion',
    visConfig: {
      defaults: {
        legendPosition: 'bottomright',
        addTooltip: true,
        colorSchema: 'Yellow to Red',
        emsHotLink: '',
        isDisplayWarning: true,
        wms: uiSettings.get('visualization:tileMap:WMSdefaults'),
        mapZoom: 2,
        mapCenter: [0, 0],
        outlineWeight: 1,
        showAllShapes: true, //still under consideration
      },
    },
    visualization,
    editorConfig: {
      optionTabs: () => {
        return [
          {
            name: 'options',
            title: i18n.translate(
              'regionMap.mapVis.regionMapEditorConfig.optionTabs.optionsTitle',
              {
                defaultMessage: 'Layer Options',
              }
            ),
            editor: (props) => (
              <RegionMapOptions {...props} getServiceSettings={getServiceSettings} />
            ),
          },
          ...additionalOptions,
        ];
      },
      collections: {
        colorSchemas: truncatedColorSchemas,
        vectorLayers: [],
        tmsLayers: [],
      },
      schemas: new Schemas([
        {
          group: 'metrics',
          name: 'metric',
          title: i18n.translate('regionMap.mapVis.regionMapEditorConfig.schemas.metricTitle', {
            defaultMessage: 'Value',
          }),
          min: 1,
          max: 1,
          aggFilter: [
            'count',
            'avg',
            'sum',
            'min',
            'max',
            'cardinality',
            'top_hits',
            'sum_bucket',
            'min_bucket',
            'max_bucket',
            'avg_bucket',
          ],
          defaults: [{ schema: 'metric', type: 'count' }],
        },
        {
          group: 'buckets',
          name: 'segment',
          title: i18n.translate('regionMap.mapVis.regionMapEditorConfig.schemas.segmentTitle', {
            defaultMessage: 'Shape field',
          }),
          min: 1,
          max: 1,
          aggFilter: ['terms'],
        },
      ]),
    },
    setup: async (vis) => {
      const serviceSettings = await getServiceSettings();
      const tmsLayers = await serviceSettings.getTMSServices();
      vis.type.editorConfig.collections.tmsLayers = tmsLayers;
      if (!vis.params.wms.selectedTmsLayer && tmsLayers.length) {
        vis.params.wms.selectedTmsLayer = tmsLayers[0];
      }

      const vectorLayers = regionmapsConfig.layers.map(
        mapToLayerWithId.bind(null, ORIGIN.OPENSEARCH_DASHBOARDS_YML)
      );
      let selectedLayer = vectorLayers[0];
      let selectedJoinField = selectedLayer ? selectedLayer.fields[0] : null;
      if (regionmapsConfig.includeOpenSearchMapsService) {
        const layers = await serviceSettings.getFileLayers();
        const newLayers = layers
          .map(mapToLayerWithId.bind(null, ORIGIN.EMS))
          .filter(
            (layer) => !vectorLayers.some((vectorLayer) => vectorLayer.layerId === layer.layerId)
          );

        // backfill v1 manifest for now
        newLayers.forEach((layer) => {
          if (layer.format === 'geojson') {
            layer.format = {
              type: 'geojson',
            };
          }
        });

        vis.type.editorConfig.collections.vectorLayers = [...vectorLayers, ...newLayers];

        [selectedLayer] = vis.type.editorConfig.collections.vectorLayers;
        selectedJoinField = selectedLayer ? selectedLayer.fields[0] : null;

        if (selectedLayer && !vis.params.selectedLayer && selectedLayer.isEMS) {
          vis.params.emsHotLink = await serviceSettings.getEMSHotLink(selectedLayer);
        }
      }

      if (!vis.params.selectedLayer) {
        vis.params.selectedLayer = selectedLayer;
        vis.params.selectedJoinField = selectedJoinField;
      }

      return vis;
    },
  };
}
