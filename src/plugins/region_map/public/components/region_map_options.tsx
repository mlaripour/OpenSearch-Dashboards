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

import React, { useCallback, useMemo } from 'react';
import { EuiIcon, EuiLink, EuiPanel, EuiSpacer, EuiText, EuiTitle } from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { FormattedMessage } from '@osd/i18n/react';
import { VisOptionsProps } from 'src/plugins/vis_default_editor/public';
import { FileLayerField, VectorLayer, IServiceSettings } from '../../../maps_legacy/public';
import { NumberInputOption, SelectOption, SwitchOption } from '../../../charts/public';
import { RegionMapVisParams, WmsOptions } from '../../../maps_legacy/public';

const mapLayerForOption = ({ layerId, name }: VectorLayer) => ({
  text: name,
  value: layerId,
});

const mapFieldForOption = ({ description, name }: FileLayerField) => ({
  text: description,
  value: name,
});

export type RegionMapOptionsProps = {
  getServiceSettings: () => Promise<IServiceSettings>;
} & VisOptionsProps<RegionMapVisParams>;

function RegionMapOptions(props: RegionMapOptionsProps) {
  const { getServiceSettings, stateParams, vis, setValue } = props;
  const { vectorLayers } = vis.type.editorConfig.collections;
  const vectorLayerOptions = useMemo(() => vectorLayers.map(mapLayerForOption), [vectorLayers]);
  const fieldOptions = useMemo(
    () =>
      ((stateParams.selectedLayer && stateParams.selectedLayer.fields) || []).map(
        mapFieldForOption
      ),
    [stateParams.selectedLayer]
  );

  const setEmsHotLink = useCallback(
    async (layer: VectorLayer) => {
      const serviceSettings = await getServiceSettings();
      const emsHotLink = await serviceSettings.getEMSHotLink(layer);
      setValue('emsHotLink', emsHotLink);
    },
    [setValue, getServiceSettings]
  );

  const setLayer = useCallback(
    async (paramName: 'selectedLayer', value: VectorLayer['layerId']) => {
      const newLayer = vectorLayers.find(({ layerId }: VectorLayer) => layerId === value);

      if (newLayer) {
        setValue(paramName, newLayer);
        setValue('selectedJoinField', newLayer.fields[0]);
        setEmsHotLink(newLayer);
      }
    },
    [vectorLayers, setEmsHotLink, setValue]
  );

  const setField = useCallback(
    (paramName: 'selectedJoinField', value: FileLayerField['name']) => {
      if (stateParams.selectedLayer) {
        setValue(
          paramName,
          stateParams.selectedLayer.fields.find((f) => f.name === value)
        );
      }
    },
    [setValue, stateParams.selectedLayer]
  );

  return (
    <>
      <EuiPanel paddingSize="s">
        <EuiTitle size="xs">
          <h2>
            <FormattedMessage
              id="regionMap.visParams.layerSettingsTitle"
              defaultMessage="Layer settings"
            />
          </h2>
        </EuiTitle>
        <EuiSpacer size="s" />

        <SelectOption
          id="regionMapOptionsSelectLayer"
          label={i18n.translate('regionMap.visParams.vectorMapLabel', {
            defaultMessage: 'Vector map',
          })}
          options={vectorLayerOptions}
          paramName="selectedLayer"
          value={stateParams.selectedLayer && stateParams.selectedLayer.layerId}
          setValue={setLayer}
        />

        <SelectOption
          id="regionMapOptionsSelectJoinField"
          label={i18n.translate('regionMap.visParams.joinFieldLabel', {
            defaultMessage: 'Join field',
          })}
          options={fieldOptions}
          paramName="selectedJoinField"
          value={stateParams.selectedJoinField && stateParams.selectedJoinField.name}
          setValue={setField}
        />

        <SwitchOption
          label={i18n.translate('regionMap.visParams.displayWarningsLabel', {
            defaultMessage: 'Display warnings',
          })}
          tooltip={i18n.translate('regionMap.visParams.switchWarningsTipText', {
            defaultMessage:
              'Turns on/off warnings. When turned on, warning will be shown for each term that cannot be matched to a shape in the vector layer based on the join field. When turned off, these warnings will be turned off.',
          })}
          paramName="isDisplayWarning"
          value={stateParams.isDisplayWarning}
          setValue={setValue}
        />

        <SwitchOption
          label={i18n.translate('regionMap.visParams.showAllShapesLabel', {
            defaultMessage: 'Show all shapes',
          })}
          tooltip={i18n.translate('regionMap.visParams.turnOffShowingAllShapesTipText', {
            defaultMessage:
              'Turning this off only shows the shapes that were matched with a corresponding term.',
          })}
          paramName="showAllShapes"
          value={stateParams.showAllShapes}
          setValue={setValue}
        />
      </EuiPanel>

      <EuiSpacer size="s" />

      <EuiPanel paddingSize="s">
        <EuiTitle size="xs">
          <h2>
            <FormattedMessage
              id="regionMap.visParams.styleSettingsLabel"
              defaultMessage="Style settings"
            />
          </h2>
        </EuiTitle>
        <EuiSpacer size="s" />

        <SelectOption
          label={i18n.translate('regionMap.visParams.colorSchemaLabel', {
            defaultMessage: 'Color schema',
          })}
          options={vis.type.editorConfig.collections.colorSchemas}
          paramName="colorSchema"
          value={stateParams.colorSchema}
          setValue={setValue}
        />

        <NumberInputOption
          label={i18n.translate('regionMap.visParams.outlineWeightLabel', {
            defaultMessage: 'Border thickness',
          })}
          min={0}
          paramName="outlineWeight"
          value={stateParams.outlineWeight}
          setValue={setValue}
        />
      </EuiPanel>

      <EuiSpacer size="s" />

      <WmsOptions {...props} />
    </>
  );
}

export { RegionMapOptions };
