/**
 * app.js
 *
 * This is the entry file for the application, only setup and boilerplate
 * code.
 */
import 'babel-polyfill';

// Import all the third party stuff
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyRouterMiddleware, Router, browserHistory } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';
import useScroll from 'react-router-scroll';
import _ from 'lodash';
import LanguageProvider from 'containers/LanguageProvider';
import NotificationProvider from 'containers/NotificationProvider';
import configureStore from './store';

// Import i18n messages
import { translationMessages, languages } from './i18n';

// Import the CSS reset, which HtmlWebpackPlugin transfers to the build folder
import 'sanitize.css/sanitize.css';

// Create redux store with history
// this uses the singleton browserHistory provided by react-router
// Optionally, this could be changed to leverage a created history
// e.g. `const browserHistory = useRouterHistory(createBrowserHistory)();`
const initialState = {};
const store = configureStore(initialState, browserHistory);

// Sync history and store, as the react-router-redux reducer
// is under the non-default key ("routing"), selectLocationState
// must be provided for resolving how to retrieve the "route" in the state
import { selectLocationState } from 'containers/App/selectors';
const history = syncHistoryWithStore(browserHistory, store, {
  selectLocationState: selectLocationState(),
});

// Set up the router, wrapping all Routes in the App component
import App from 'containers/App';
import createRoutes from './routes';
const rootRoute = {
  component: App,
  childRoutes: createRoutes(store),
};

const render = (translatedMessages) => {
  ReactDOM.render(
    <Provider store={store}>
      <LanguageProvider messages={translatedMessages}>
        <NotificationProvider>
          <Router
            history={history}
            routes={rootRoute}
            render={
              // Scroll to top when going to a new page, imitating default browser
              // behaviour
              applyRouterMiddleware(useScroll())
            }
          />
        </NotificationProvider>
      </LanguageProvider>
    </Provider>,
    document.getElementById('app')
  );
};


// Hot reloadable translation json files
if (module.hot) {
  // modules.hot.accept does not accept dynamic dependencies,
  // have to be constants at compile-time
  module.hot.accept('./i18n', () => {
    render(translationMessages);
  });
}

// Chunked polyfill for browsers without Intl support
window.onload = function onLoad() {
  if (!window.Intl) {
    Promise.all([
      System.import('intl'),
      System.import('intl/locale-data/jsonp/en.js'),
      System.import('intl/locale-data/jsonp/fr.js'),
    ]).then(() => render(translationMessages));
  } else {
    render(translationMessages);
  }
};

// Install ServiceWorker and AppCache in the end since
// it's not most important operation and if main code fails,
// we do not want it installed
// import { install } from 'offline-plugin/runtime';
// install();

import { pluginLoaded, updatePlugin } from './containers/App/actions';

/**
 * Public Strapi object exposed to the `window` object
 */

/**
 * Register a plugin
 *
 * @param params
 */
const registerPlugin = (plugin) => {
  const formattedPlugin = plugin;

  // Add routes
  // Initial list of routes
  const homeRoute = rootRoute.childRoutes[0];
  const pluginsRoute = _.find(homeRoute.childRoutes, { name: 'plugins' });

  // Create a new prefixed route for each plugin routes
  if (formattedPlugin && formattedPlugin.routes) {
    formattedPlugin.routes.forEach(route => {
      pluginsRoute.childRoutes.push({
        path: `/plugins/${formattedPlugin.id}${route.path}`,
        name: `plugins_${formattedPlugin.id}_${route.name}`,
        getComponent: route.getComponent,
      });
    });
  }

  // Merge admin translation messages
  _.merge(translationMessages, formattedPlugin.translationMessages);

  formattedPlugin.leftMenuSections = formattedPlugin.leftMenuSections || [];

  store.dispatch(pluginLoaded(formattedPlugin));
};

import { showNotification } from './containers/NotificationProvider/actions';

const displayNotification = (message, status) => {
  store.dispatch(showNotification(message, status));
};

const port = window.Strapi && window.Strapi.port ? window.Strapi.port : 1337;
const apiUrl = window.Strapi && window.Strapi.apiUrl ? window.Strapi.apiUrl : `http://localhost:${port}`;

window.Strapi = {
  registerPlugin,
  notification: {
    success: (message) => {
      displayNotification(message, 'success');
    },
    warning: (message) => {
      displayNotification(message, 'warning');
    },
    error: (message) => {
      displayNotification(message, 'error');
    },
    info: (message) => {
      displayNotification(message, 'info');
    },
  },
  port,
  apiUrl,
  refresh: (pluginId) => ({
    translationMessages: (translationMessagesUpdated) => {
      render(_.merge({}, translationMessages, translationMessagesUpdated));
    },
    leftMenuSections: (leftMenuSectionsUpdated) => {
      store.dispatch(updatePlugin(pluginId, 'leftMenuSections', leftMenuSectionsUpdated));
    },
  }),
  router: browserHistory,
  languages,
};

const dispatch = store.dispatch;
export {
  dispatch,
};
