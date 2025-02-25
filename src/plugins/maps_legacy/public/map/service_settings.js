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

import _ from 'lodash';
import MarkdownIt from 'markdown-it';
import { EMSClient } from '@elastic/ems-client';
import { OpenSearchMapsClient } from '../common/opensearch_maps_client.js';
import { i18n } from '@osd/i18n';
import { getOpenSearchDashboardsVersion } from '../opensearch_dashboards_services';
import { ORIGIN } from '../common/constants/origin';

const TMS_IN_YML_ID = 'TMS in config/opensearch_dashboards.yml';

// When unable to fetch OpenSearch maps service, return default values to
// make sure wms can be set up.
export const DEFAULT_SERVICE = [
  {
    origin: 'elastic_maps_service',
    id: 'road_map',
    minZoom: 0,
    maxZoom: 22,
    attribution:
      '<a rel="noreferrer noopener" href="https://www.openstreetmap.org/copyright">Map data © OpenStreetMap contributors</a>',
  },
];

export class ServiceSettings {
  constructor(mapConfig, tilemapsConfig) {
    this._mapConfig = mapConfig;
    this._tilemapsConfig = tilemapsConfig;
    this._hasTmsConfigured = typeof tilemapsConfig.url === 'string' && tilemapsConfig.url !== '';

    this._showZoomMessage = true;
    this._emsClient = null;
    this._opensearchMapsClient = new OpenSearchMapsClient({
      language: i18n.getLocale(),
      appVersion: getOpenSearchDashboardsVersion(),
      appName: 'opensearch-dashboards',
      fileApiUrl: this._mapConfig.emsFileApiUrl,
      tileApiUrl: this._mapConfig.emsTileApiUrl,
      landingPageUrl: '',
      manifestServiceUrl: this._mapConfig.opensearchManifestServiceUrl,
      // Wrap to avoid errors passing window fetch
      fetchFunction: function (...args) {
        return fetch(...args);
      },
    });
    this.getTMSOptions();
  }

  getTMSOptions() {
    const markdownIt = new MarkdownIt({
      html: false,
      linkify: true,
    });

    // TMS Options
    this.tmsOptionsFromConfig = _.assign({}, this._tilemapsConfig.options, {
      attribution: _.escape(markdownIt.render(this._tilemapsConfig.options.attribution || '')),
      url: this._tilemapsConfig.url,
    });
  }

  shouldShowZoomMessage({ origin }) {
    return origin === ORIGIN.EMS && this._showZoomMessage;
  }

  enableZoomMessage() {
    this._showZoomMessage = true;
  }

  disableZoomMessage() {
    this._showZoomMessage = false;
  }

  __debugStubManifestCalls(manifestRetrieval) {
    this._emsClient = this._opensearchMapsClient;
    const oldGetManifest = this._emsClient.getManifest;
    this._emsClient.getManifest = manifestRetrieval;
    return {
      removeStub: () => {
        delete this._emsClient.getManifest;
        //not strictly necessary since this is prototype method
        if (this._emsClient.getManifest !== oldGetManifest) {
          this._emsClient.getManifest = oldGetManifest;
        }
      },
    };
  }

  _backfillSettings = (fileLayer) => {
    // Older version of OpenSearch Dashboards stored EMS state in the URL-params
    // Creates object literal with required parameters as key-value pairs
    const format = fileLayer.getDefaultFormatType();
    const meta = fileLayer.getDefaultFormatMeta();

    return {
      name: fileLayer.getDisplayName(),
      origin: fileLayer.getOrigin(),
      id: fileLayer.getId(),
      created_at: fileLayer.getCreatedAt(),
      attribution: getAttributionString(fileLayer),
      fields: fileLayer.getFieldsInLanguage(),
      format: format, //legacy: format and meta are split up
      meta: meta, //legacy, format and meta are split up
    };
  };

  // anyone using this._emsClient should call this method before, to set the right client
  async _setMapServices() {
    // if client is not null, return immediately.
    // Effectively, client creation will be called only once.
    if (this._emsClient) {
      return;
    }
    const useOpenSearchMaps = await this._opensearchMapsClient.isEnabled();
    if (useOpenSearchMaps) {
      // using OpenSearch Maps.
      this._emsClient = this._opensearchMapsClient;
    } else {
      // not using OpenSearch Maps, fallback to default maps.
      this._emsClient = new EMSClient({
        language: i18n.getLocale(),
        appVersion: getOpenSearchDashboardsVersion(),
        appName: 'opensearch-dashboards',
        fileApiUrl: this._mapConfig.emsFileApiUrl,
        tileApiUrl: this._mapConfig.emsTileApiUrl,
        landingPageUrl: this._mapConfig.emsLandingPageUrl,
        fetchFunction: function (...args) {
          return fetch(...args);
        },
      });
    }
  }

  async getFileLayers() {
    if (!this._mapConfig.includeOpenSearchMapsService) {
      return [];
    }

    await this._setMapServices();
    try {
      const fileLayers = await this._emsClient.getFileLayers();
      return fileLayers.map(this._backfillSettings);
    } catch (e) {
      return [];
    }
  }

  /**
   * Returns all the services published by EMS (if configures)
   * It also includes the service configured in tilemap (override)
   */
  async getTMSServices() {
    let allServices = [];
    if (this._hasTmsConfigured) {
      //use tilemap.* settings from yml
      const tmsService = _.cloneDeep(this.tmsOptionsFromConfig);
      tmsService.id = TMS_IN_YML_ID;
      tmsService.origin = ORIGIN.OPENSEARCH_DASHBOARDS_YML;
      allServices.push(tmsService);
    }

    await this._setMapServices();
    if (this._mapConfig.includeOpenSearchMapsService) {
      let servicesFromManifest = [];
      try {
        servicesFromManifest = await this._emsClient.getTMSServices();
      } catch (e) {
        return DEFAULT_SERVICE;
      }
      const strippedServiceFromManifest = await Promise.all(
        servicesFromManifest
          .filter((tmsService) => tmsService.getId() === this._mapConfig.emsTileLayerId.bright)
          .map(async (tmsService) => {
            //shim for compatibility
            return {
              origin: tmsService.getOrigin(),
              id: tmsService.getId(),
              minZoom: await tmsService.getMinZoom(),
              maxZoom: await tmsService.getMaxZoom(),
              attribution: getAttributionString(tmsService),
            };
          })
      );
      allServices = allServices.concat(strippedServiceFromManifest);
    }

    return allServices;
  }

  /**
   * Set optional query-parameters for all requests
   *
   * @param additionalQueryParams
   */
  setQueryParams(additionalQueryParams) {
    // Functions more as a "set" than an "add" in ems-client
    this._emsClient.addQueryParams(additionalQueryParams);
  }

  async getFileLayerFromConfig(fileLayerConfig) {
    let fileLayers = [];
    try {
      fileLayers = await this._emsClient.getFileLayers();
      return fileLayers.find((fileLayer) => {
        const hasIdByName = fileLayer.hasId(fileLayerConfig.name); //legacy
        const hasIdById = fileLayer.hasId(fileLayerConfig.id);
        return hasIdByName || hasIdById;
      });
    } catch (err) {
      return null;
    }
  }

  async getEMSHotLink(fileLayerConfig) {
    await this._setMapServices();
    const layer = await this.getFileLayerFromConfig(fileLayerConfig);
    return layer ? layer.getEMSHotLink() : null;
  }

  async loadFileLayerConfig(fileLayerConfig) {
    const fileLayer = await this.getFileLayerFromConfig(fileLayerConfig);
    return fileLayer ? this._backfillSettings(fileLayer) : null;
  }

  async _getAttributesForEMSTMSLayer(isDesaturated, isDarkMode) {
    await this._setMapServices();
    let tmsServices = [];
    try {
      tmsServices = await this._emsClient.getTMSServices();
    } catch (e) {
      return DEFAULT_SERVICE;
    }
    const emsTileLayerId = this._mapConfig.emsTileLayerId;
    let serviceId;
    if (isDarkMode) {
      serviceId = emsTileLayerId.dark;
    } else {
      if (isDesaturated) {
        serviceId = emsTileLayerId.desaturated;
      } else {
        serviceId = emsTileLayerId.bright;
      }
    }
    const tmsService = tmsServices.find((service) => {
      return service.getId() === serviceId;
    });
    return {
      url: await tmsService.getUrlTemplate(),
      minZoom: await tmsService.getMinZoom(),
      maxZoom: await tmsService.getMaxZoom(),
      attribution: getAttributionString(tmsService),
      origin: ORIGIN.EMS,
    };
  }

  async getAttributesForTMSLayer(tmsServiceConfig, isDesaturated, isDarkMode) {
    if (tmsServiceConfig.origin === ORIGIN.EMS) {
      return this._getAttributesForEMSTMSLayer(isDesaturated, isDarkMode);
    } else if (tmsServiceConfig.origin === ORIGIN.OPENSEARCH_DASHBOARDS_YML) {
      const attrs = _.pick(this._tilemapsConfig, ['url', 'minzoom', 'maxzoom', 'attribution']);
      return { ...attrs, ...{ origin: ORIGIN.OPENSEARCH_DASHBOARDS_YML } };
    } else {
      //this is an older config. need to resolve this dynamically.
      if (tmsServiceConfig.id === TMS_IN_YML_ID) {
        const attrs = _.pick(this._tilemapsConfig, ['url', 'minzoom', 'maxzoom', 'attribution']);
        return { ...attrs, ...{ origin: ORIGIN.OPENSEARCH_DASHBOARDS_YML } };
      } else {
        //assume ems
        return this._getAttributesForEMSTMSLayer(isDesaturated, isDarkMode);
      }
    }
  }

  async _getFileUrlFromEMS(fileLayerConfig) {
    await this._setMapServices();
    const fileLayers = await this._emsClient.getFileLayers();
    const layer = fileLayers.find((fileLayer) => {
      const hasIdByName = fileLayer.hasId(fileLayerConfig.name); //legacy
      const hasIdById = fileLayer.hasId(fileLayerConfig.id);
      return hasIdByName || hasIdById;
    });

    if (layer) {
      return layer.getDefaultFormatUrl();
    } else {
      throw new Error(`File  ${fileLayerConfig.name} not recognized`);
    }
  }

  async getUrlForRegionLayer(fileLayerConfig) {
    let url;
    if (fileLayerConfig.origin === ORIGIN.EMS) {
      url = this._getFileUrlFromEMS(fileLayerConfig);
    } else if (fileLayerConfig.layerId && fileLayerConfig.layerId.startsWith(`${ORIGIN.EMS}.`)) {
      //fallback for older saved objects
      url = this._getFileUrlFromEMS(fileLayerConfig);
    } else if (
      fileLayerConfig.layerId &&
      fileLayerConfig.layerId.startsWith(`${ORIGIN.OPENSEARCH_DASHBOARDS_YML}.`)
    ) {
      //fallback for older saved objects
      url = fileLayerConfig.url;
    } else {
      //generic fallback
      url = fileLayerConfig.url;
    }
    return url;
  }

  async getJsonForRegionLayer(fileLayerConfig) {
    const url = await this.getUrlForRegionLayer(fileLayerConfig);
    const response = await fetch(url);
    return await response.json();
  }
}

function getAttributionString(emsService) {
  const attributions = emsService.getAttributions();
  const attributionSnippets = attributions.map((attribution) => {
    const anchorTag = document.createElement('a');
    anchorTag.setAttribute('rel', 'noreferrer noopener');
    if (attribution.url.startsWith('http://') || attribution.url.startsWith('https://')) {
      anchorTag.setAttribute('href', attribution.url);
    }
    anchorTag.textContent = attribution.label;
    return anchorTag.outerHTML;
  });
  return attributionSnippets.join(' | '); //!!!this is the current convention used in OpenSearch Dashboards
}
