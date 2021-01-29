import { whenOnce } from '@arcgis/core/core/watchUtils';

import { property, subclass } from '@arcgis/core/core/accessorSupport/decorators';

import { renderable, tsx } from '@arcgis/core/widgets/support/widget';

import Widget from '@arcgis/core/widgets/Widget';

import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

// import PrintViewModel from '@arcgis/core/widgets/Print/PrintViewModel';
// import PrintTemplate from '@arcgis/core/tasks/support/PrintTemplate';

import { geodesicBuffer } from '@arcgis/core/geometry/geometryEngine';
import Graphic from '@arcgis/core/Graphic';
import { SimpleFillSymbol } from '@arcgis/core/symbols';
import { SimpleRenderer } from '@arcgis/core/renderers';

import FeatureTable from '@arcgis/core/widgets/FeatureTable';
import FieldColumnConfig from '@arcgis/core/widgets/FeatureTable/FieldColumnConfig';

import { unparse } from 'papaparse';

import { fileCsv16 } from '@esri/calcite-ui-icons/js/fileCsv16';
import { table16 } from '@esri/calcite-ui-icons/js/table16';
import { print16 } from '@esri/calcite-ui-icons/js/print16';

interface TaxLotBufferProperties extends esri.WidgetProperties {
  view: esri.MapView;
  layer: esri.FeatureLayer;
  bufferSymbol?: esri.SimpleFillSymbol;
  selectedSymbol?: esri.SimpleFillSymbol;
}

const CSS = {
  base: 'tax-lot-buffer-widget esri-widget',
  button: 'esri-button',
  widgetButton: 'esri-widget--button',
  input: 'esri-input',

  buttonRow: 'tax-lot-buffer-widget--button-row',
  results: 'tax-lot-buffer-widget--results',

  table: 'esri-widget__table',
  th: 'esri-feature__field-header',
  td: 'esri-feature__field-data',

  featureTable: 'tax-lot-buffer-widget--feature-table',
  featureTableShowing: 'feature-table--showing',
  featureTableCloseButton: 'feature-table--close-button',
};

let KEY = 0;

@subclass('app.widgets.TaxLotBuffer')
export default class TaxLotBuffer extends Widget {
  @property()
  view!: esri.MapView;

  @property()
  layer!: esri.FeatureLayer;

  @property()
  bufferSymbol = new SimpleFillSymbol({
    color: [0, 0, 0, 0],
    outline: {
      style: 'dash',
      color: [255, 255, 0, 0.75],
      width: 3,
    },
  });

  @property()
  selectedSymbol = new SimpleFillSymbol({
    color: [0, 255, 255, 0.25],
    outline: {
      color: [0, 255, 255, 1],
      width: 2,
    },
  });

  @property()
  private _layerView!: esri.FeatureLayerView;

  @property()
  @renderable()
  private _feature: esri.Graphic | null = null;

  @property()
  private _highlight!: esri.Handle;

  @property()
  private _resultLayer!: FeatureLayer;

  @property()
  @renderable()
  private _results: Graphic[] = [];

  @property()
  private _resultTableContainer = document.createElement('div');

  @property()
  private _resultTable!: FeatureTable;

  constructor(properties?: TaxLotBufferProperties) {
    super(properties);
    whenOnce(this, 'layer.loaded', this._init.bind(this));
  }

  private _init(): void {
    const { view, layer, selectedSymbol, _resultTableContainer } = this;

    // wire hit test
    view.whenLayerView(layer).then((laverView: esri.FeatureLayerView): void => {
      this._layerView = laverView;
    });

    view.on('click', (point: esri.ScreenPoint): void => {
      view.hitTest(point).then(this._hitTest.bind(this));
    });

    // results feature layer
    this._resultLayer = new FeatureLayer({
      source: [],
      geometryType: layer.geometryType,
      fields: layer.fields,
      objectIdField: layer.objectIdField,
      renderer: new SimpleRenderer({
        symbol: selectedSymbol,
      }),
    });

    // results feature layer
    view.map.add(this._resultLayer);

    // results table
    this._resultTable = new FeatureTable({
      layer: this._resultLayer,
      columnReorderingEnabled: false,
      highlightOnRowSelectEnabled: false,
      visibleElements: {
        header: false,
        menu: false,
        menuItems: {
          clearSelection: false,
          refreshData: false,
          toggleColumns: false,
        },
        selectionColumn: false,
      },
      fieldConfigs: [
        new FieldColumnConfig({
          name: 'TAXLOT_ID',
          label: 'Tax Lot',
          direction: 'asc',
          sortable: true,
        }),
        new FieldColumnConfig({
          name: 'OWNER',
          label: 'Owner',
          sortable: true,
        }),
        new FieldColumnConfig({
          name: 'ADDRESS',
          label: 'Address',
          sortable: false,
        }),
        new FieldColumnConfig({
          name: 'ACCOUNT_IDS',
          label: 'Account Id(s)',
          sortable: false,
          // @ts-ignore
          formatFunction: (info: {
            config: FieldColumnConfig;
            field: esri.Field;
            value: string | number | null | undefined;
          }) => {
            let links = '';
            (info.value as string).split(',').forEach((value: string) => {
              links += `<a style="margin-right:0.5rem;" href="http://www.helioncentral.com/columbiaat/MainQueryDetails.aspx?AccountID=${value}&QueryYear=2021&Roll=R" target="_blank" rel="noopener">${value}</a>`;
            });
            return links;
          },
        }),
      ],
      container: document.createElement('div'),
    });
    _resultTableContainer.append(this._resultTable.container);
    _resultTableContainer.classList.add(CSS.featureTable);
    document.body.append(_resultTableContainer);

    // close button
    const closeButton = document.createElement('div');
    closeButton.innerHTML = `<span class="esri-icon esri-icon-close"></span><span class="esri-icon-font-fallback-text">Close</span>`;
    closeButton.classList.add(CSS.widgetButton, CSS.featureTableCloseButton);
    closeButton.addEventListener('click', this._toggleFeatureTable.bind(this));
    _resultTableContainer.append(closeButton);
  }

  private _hitTest(response: esri.HitTestResult): void {
    const { layer, _layerView } = this;
    const { results } = response;

    this._clear();

    if (!results.length) return;

    const filter = results.filter((value: esri.HitTestResultResults) => {
      return value.graphic.layer === layer;
    });

    if (filter[0] && filter[0].graphic) {
      this._feature = filter[0].graphic;
      this._highlight = _layerView.highlight(this._feature);
    }
  }

  private _clear(preserveSelect?: boolean): void {
    const { view, _feature, _highlight, _resultLayer } = this;

    if (!preserveSelect) {
      if (_highlight) _highlight.remove();
      if (_feature) this._feature = null;
    }

    this._results = [];

    view.graphics.removeAll();

    _resultLayer
      .queryFeatures({
        where: '1 = 1',
      })
      .then((result: esri.FeatureSet) => {
        _resultLayer.applyEdits({
          deleteFeatures: result.features,
        });
      });
  }

  private _buffer(evt: Event): void {
    evt.preventDefault();
    const { view, bufferSymbol, layer, _feature } = this;
    const distance = parseInt((document.querySelector('input[data-buffer-distance]') as HTMLInputElement).value);

    if (!_feature || !distance) return;

    this._clear(true);

    layer
      .queryFeatures({
        where: `TAXLOT_ID = '${_feature.attributes.TAXLOT_ID}'`,
        outFields: [layer.objectIdField],
        returnGeometry: true,
        outSpatialReference: {
          wkid: 102100,
        },
      })
      .then((result: esri.FeatureSet) => {
        const geometry = result.features[0].geometry;

        const buffer = geodesicBuffer(geometry, distance, 'feet', true) as esri.Polygon;

        view.graphics.add(
          new Graphic({
            geometry: buffer,
            symbol: bufferSymbol,
          }),
        );

        view.goTo(buffer);

        this._select(buffer);
      });
  }

  private _select(buffer: esri.Polygon): void {
    const { layer, _feature, _resultLayer } = this;

    if (!_feature) return;

    layer
      .queryFeatures({
        where: `${layer.objectIdField} <> ${_feature.attributes[layer.objectIdField]}`,
        geometry: buffer,
        outFields: ['*'],
        returnGeometry: true,
        outSpatialReference: {
          wkid: 102100,
        },
      })
      .then((result: esri.FeatureSet) => {
        const { features: addFeatures } = result;
        _resultLayer.applyEdits({
          addFeatures,
        });
        this._results = addFeatures;
      });
  }

  private _toggleFeatureTable(): void {
    const { _resultTable } = this;
    this._resultTableContainer.classList.toggle(CSS.featureTableShowing);
    _resultTable.refresh();
  }

  private _download(): void {
    const { _feature, _results } = this;
    if (!_results.length) return;

    const json = _results.map((feature: Graphic) => {
      const { attributes } = feature;

      // just need one account link in download
      const accounts = attributes.ACCOUNT_IDS.split(',').map((account: string) => {
        return `http://www.helioncentral.com/columbiaat/MainQueryDetails.aspx?AccountID=${account}&QueryYear=2021&Roll=R`;
      });

      const result = {
        'Tax Lot': attributes.TAXLOT_ID,
        Owner: attributes.OWNER,
        Address: attributes.ADDRESS,
        Account: accounts[0] || ' ',
      };

      return result;
    });

    const csv = unparse(json);

    const a = document.createElement('a');
    a.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
    a.setAttribute('download', `${_feature?.attributes.TAXLOT_ID}_BufferResults.csv`);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  render(): tsx.JSX.Element {
    const { _feature, _results } = this;

    if (!_feature) {
      return (
        <div key={KEY++} class={CSS.base}>
          <span>Select a tax lot to buffer</span>
        </div>
      );
    } else {
      const attributes = _feature.attributes;
      return (
        <div key={KEY++} class={CSS.base}>
          {/* selected tax lot info */}
          <table class={CSS.table}>
            <tr>
              <th class={CSS.th}>Tax Lot</th>
              <td class={CSS.td}>{attributes.TAXLOT_ID}</td>
            </tr>
            <tr>
              <th class={CSS.th}>Owner</th>
              <td class={CSS.td}>{attributes.OWNER}</td>
            </tr>
            {attributes.ADDRESS ? (
              <tr key={KEY++}>
                <th class={CSS.th}>Address</th>
                <td class={CSS.td}>{attributes.ADDRESS}</td>
              </tr>
            ) : null}
          </table>

          {/* buffer form */}
          <form bind={this} onsubmit={this._buffer}>
            <input
              data-buffer-distance=""
              type="number"
              class={CSS.input}
              value="250"
              min="10"
              max="2000"
              step="1"
              required={true}
              placeholder="Buffer distance"
            />
            <span>feet</span>
            <button class={CSS.button} type="submit">
              Buffer
            </button>
          </form>

          {/* results */}
          {_results.length ? (
            <div key={KEY++} class={CSS.results}>
              <span>{_results.length} buffer results.</span>
              <div class={CSS.buttonRow}>
                <button class={CSS.button} title="View Table" bind={this} onclick={this._toggleFeatureTable}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    <path d={table16} />
                  </svg>
                </button>
                <button class={CSS.button} title="Download CSV File" bind={this} onclick={this._download}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    <path d={fileCsv16} />
                  </svg>
                </button>
                <button
                  class={CSS.button}
                  title="Print Map"
                  onclick={() => {
                    alert('Print coming soon.');
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    <path d={print16} />
                  </svg>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      );
    }
  }
}
