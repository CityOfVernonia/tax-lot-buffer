import app = __app;

import { whenOnce } from '@arcgis/core/core/watchUtils';

import { property, subclass } from '@arcgis/core/core/accessorSupport/decorators';

import { tsx } from '@arcgis/core/widgets/support/widget';

import Widget from '@arcgis/core/widgets/Widget';

import AppViewModel from 'app/App/AppViewModel';

const CSS = {
  base: 'app',
  title: 'app--title',
  view: 'app--view',
};

@subclass('app/App')
export default class App extends Widget {
  // view model has no purpose here but more complex apps should have all logic and _init() contained therein
  @property({
    type: AppViewModel,
  })
  viewModel = new AppViewModel();

  @property({
    aliasOf: 'viewModel.view',
  })
  view!: esri.MapView | esri.SceneView;

  @property()
  title = 'ArcGIS for JavaScript';

  constructor(properties: app.AppProperties) {
    super(properties);
    whenOnce(this, 'view', this._init.bind(this));
  }

  private async _init(): Promise<void> {
    const { view, title } = this;

    const titleText = document.createElement('div');
    titleText.innerHTML = title;
    titleText.classList.add(CSS.title);

    view.ui.add(titleText, {
      position: 'top-left',
      index: 0,
    });

    setTimeout((): void => {
      view.container = document.querySelector('div[data-app-view]') as HTMLDivElement;
    }, 0);

    await view.when();
  }

  render(): tsx.JSX.Element {
    return (
      <div class={CSS.base}>
        <div class={CSS.view} data-app-view=""></div>
      </div>
    );
  }
}
