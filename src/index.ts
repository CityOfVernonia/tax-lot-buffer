import esriConfig from '@arcgis/core/config';

import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';

import Basemap from '@arcgis/core/Basemap';
import BingMapsLayer from '@arcgis/core/layers/BingMapsLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

import FullMap from 'cov/layouts/FullView';
import TaxLotBuffer from './widgets/TaxLotBuffer';

esriConfig.portalUrl = 'https://gisportal.vernonia-or.gov/portal';

const taxLots = new FeatureLayer({
  portalItem: {
    id: '2c2da300ecf34e679201059c51a16bbb',
  },
  outFields: ['*'],
  popupEnabled: false,
});

const cityLimits = new FeatureLayer({
  portalItem: {
    id: 'eb0c7507611e44b7923dd1c0167e3b92',
  },
});

cityLimits.when(() => {
  cityLimits
    .queryExtent({
      where: '1 = 1',
      outSpatialReference: {
        wkid: 102100,
      },
    })
    .then((extent: esri.Extent) => {
      view.goTo(extent);
    })
    .catch();
});

const view = new MapView({
  map: new Map({
    basemap: new Basemap({
      baseLayers: [
        new BingMapsLayer({
          style: 'aerial',
          key: 'Ao8BC5dsixV4B1uhNaUAK_ejjm6jtZ8G3oXQ5c5Q-WtmpORHOMklBvzqSIEXwdxe',
        }),
      ],
    }),
    layers: [taxLots, cityLimits],
  }),
  popup: {
    dockEnabled: true,
    dockOptions: {
      position: 'bottom-left',
      breakpoint: false,
    },
  },
  highlightOptions: {
    fillOpacity: 0,
    haloColor: 'yellow',
    haloOpacity: 0.8,
  },
});

view.when(() => {
  view.ui.add(
    new TaxLotBuffer({
      view,
      layer: taxLots,
    }),
    'top-right',
  );
});

const app = new FullMap({
  view,
  title: 'Tax Lot Buffer',
  container: document.createElement('div'),
});

document.body.append(app.container);
