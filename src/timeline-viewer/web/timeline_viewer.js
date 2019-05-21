'use strict';

const wait = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

// eslint-disable-next-line no-unused-vars
class Viewer {
  constructor() {
    this.params = new URL(location.href).searchParams;
    this.syncView = new SyncView();
    this.timelineURL = this.params.get('loadTimelineFromURL');
    this.timelineId;
    this.timelineProvider = 'url';

    this.totalSize = 50 * 1000 * 1000;
    this.loadingStarted = false;
    this.refreshPage = false;
    this.canUploadToDrive = false;
    this.welcomeView = false;
    // remote location of devtools we're using
    this.devtoolsBase = document.getElementById('devtoolsscript').src.replace(/inspector\.js.*/, '');

    this.statusElem = document.getElementById('status');
    this.authBtn = document.getElementById('auth');
    this.revokeAccessBtn = document.getElementById('revoke-access');
    this.docsElem = document.getElementById('howto');

    this.utils = new Utils();
    this.devTools = new DevTools({viewerInstance: this});

    this.attachEventListeners();

    this.driveAssetLoaded = new Promise((resolve, reject) => {
      this.driveAssetLoadedResolver = resolve;
    });

    this.parseURLforTimelineId(this.timelineURL);

    if (!this.timelineURL || this.startSplitViewIfNeeded(this.timelineURL)) {
      this.splitViewContainer = document.getElementById('split-view-container');
      this.isSplitView = this.splitViewContainer ? true : false;
      this.canUploadToDrive = true;
      this.welcomeView = true;
      this.handleDragEvents();
    }

    this.devTools.init();

    if (!this.welcomeView) {
      this.makeDevToolsVisible(true);
    }
  }

  attachEventListeners() {
    this.attachPrefillUrlListener();
  }

  attachPrefillUrlListener() {
    const input = document.querySelector('#enterurl');
    const submit = document.querySelector('input[type=submit]');

    [...document.querySelectorAll('a[data-url]')].forEach(elem => {
      elem.addEventListener('click', async evt => {
        evt.preventDefault();
        evt.cancelBubble = true;
        const url = evt.target.dataset.url;
        await wait(250);
        input.value = url;
        await wait(600);
        submit.focus();
        await wait(600);
        submit.click();
      });
    });
  }

  handleDragEvents() {
    const dropboxEl = document.getElementById('dropbox');
    if (dropboxEl)
      dropboxEl.addEventListener('dragover', this.dragover.bind(this), false);
  }

  dragover(e) {
    e.stopPropagation();
    e.preventDefault();
    this.makeDevToolsVisible(true);
  }

  parseURLforTimelineId(url) {
    try {
      const parsedURL = new URL(url);
      if (parsedURL.protocol === 'drive:') {
        this.timelineProvider = 'drive';
        this.timelineId = parsedURL.pathname.replace(/^\/+/, '');
      }
      if (parsedURL.hostname === 'drive.google.com') {
        this.timelineProvider = 'drive';
        this.timelineId = parsedURL.pathname.match(/\b[0-9a-zA-Z]{5,40}\b/)[0];
      }
    } catch (e) {
      // legacy URLs, without a drive:// prefix.
      this.timelineId = url;
      this.timelineProvider = 'drive';
    }
  }

  startSplitViewIfNeeded(urls) {
    urls = urls.split(',');

    if (urls.length > 1) {
      const frameset = document.createElement('frameset');
      frameset.setAttribute('id', 'split-view-container');
      frameset.setAttribute('rows', new Array(urls.length).fill(`${100/2}%`).join(','));

      urls.forEach((url, index) => {
        const frame = document.createElement('frame');
        frame.setAttribute('id', `split-view-${index}`);
        frame.setAttribute('src', `./?loadTimelineFromURL=${url.trim()}`);
        frameset.appendChild(frame);
      });
      document.body.appendChild(frameset);
      document.documentElement.classList.add('fullbleed');
      document.querySelector('.welcome').remove();
      document.querySelector('.top-message-container').remove();
      return true;
    }
    return false;
  }

  makeDevToolsVisible(bool) {
    this.welcomeView = !bool;
    document.documentElement.classList[bool ? 'remove' : 'add']('hide-devtools');
  }

  updateStatus(str) {
    this.statusElem.textContent = str;
  }

  // checkAuth() {
  //   const handleAuth = this.handleAuthResult.bind(this);
  //   this.auth.checkAuth(handleAuth);
  //
  //   return false;
  // }

  revokeAccess() {
    this.auth.revokeAccess().then(() => {
      this.updateStatus('Drive API status: not signed in');
      this.authBtn.hidden = false;
      this.revokeAccessBtn.hidden = true;
    });
  }

  handleAuthResult() {
    if (this.timelineProvider !== 'drive') return;

    if (this.auth.isSignedIn() === false) {
      this.updateStatus('Drive API status: not signed in');

      this.authBtn.hidden = false;
      this.docsElem.hidden = false;
      this.canUploadToDrive = false;
      this.makeDevToolsVisible(false);
      return new Error('Google auth error');
    }

    this.authBtn.hidden = true;
    this.revokeAccessBtn.hidden = false;
    this.updateStatus('Drive API status: successfully signed in');
    this.statusElem.hidden = false;
    this.canUploadToDrive = true;
    this.requestDriveFileMeta();
  }

  loadResource(requestedURL) {
    return this.loadResourcePromise(requestedURL)
      .then(resp => {
        this.devTools.monkeyPatchingHandleDrop();
        return resp;
      });
  }

  // monkeypatched method for devtools
  loadResourcePromise(requestedURL) {
    const url = new URL(requestedURL, location.href);
    const URLofViewer = new URL(location.href);

    // hosted devtools gets confused
    // if DevTools is requesting a file thats on our origin, we'll redirect it to devtoolsBase
    if (url && url.origin === URLofViewer.origin) {
      const relativeurl = url.pathname.replace(URLofViewer.pathname, '').replace(/^\//, '');
      const redirectedURL = new URL(relativeurl, this.devtoolsBase);
      return this._orig_loadResourcePromise(redirectedURL.toString());
    }

    if (this.timelineProvider === 'drive')
      return this.driveAssetLoaded.then(payload => payload);

    // pass through URLs that aren't our timelineURL param
    if (requestedURL !== this.timelineURL) {
      return this._orig_loadResourcePromise(url);
    }

    // adjustments for CORS
    url.hostname = url.hostname.replace('github.com', 'githubusercontent.com');
    url.hostname = url.hostname.replace('www.dropbox.com', 'dl.dropboxusercontent.com');

    return this.fetchTimelineAsset(url.href).then(payload => payload);
  }

  requestDriveFileMeta() {
    // if there's no this.timelineId then let's skip all this drive API stuff.
    if (!this.timelineId) return;

    const url = new URL(`https://www.googleapis.com/drive/v2/files/${this.timelineId}`);
    url.searchParams.append('fields', 'version, downloadUrl, copyable, title, originalFilename, fileSize');
    url.searchParams.append('key', GoogleAuth.apiKey);

    const headers = new Headers();
    headers.append('Authorization', `Bearer ${GoogleAuth.getUserAccessToken()}`);

    this.utils.fetch(url.toString(), {headers})
      .then(resp => resp.json())
      .then(this.handleDriveFileMetadata.bind(this));
  }

  handleDriveFileMetadata(response) {
    document.title = `${response.originalFilename} | ${document.title}`;
    this.totalSize = Number(response.fileSize);
    const error = response.error;

    if (error) {
      this.makeDevToolsVisible(false);
      const reasons = error.errors.map(e => e.reason);
      let fileUnavailableStr = '';
      fileUnavailableStr += reasons.includes('notFound') ? 'Confirm you have Edit permissions to the file. ' : '';
      if (reasons.includes('authError')) {
        fileUnavailableStr += 'Please sign in. ';
        this.authBtn.hidden = false;
      }
      this.updateStatus(`${fileUnavailableStr} Drive API error: ${error.message}. (${reasons.join(', ')})`);
      throw new Error(response.message, response.error);
    }

    if (!response.downloadUrl) {
      this.makeDevToolsVisible(false);
      this.updateStatus('Downloading not available. Confirm you have Edit permissions to the file.');
      throw new Error(response.message, response.error);
    }

    this.makeDevToolsVisible(true);
    this.updateStatus('Starting download of timeline from Drive. Please wait...');
    // alt=media forces file contents in response body.
    const url = `${response.downloadUrl}&alt=media`;

    this.fetchDriveAsset(url)
      .then(payload => this.handleDriveAsset(payload))
      .catch(_ => {
        this.makeDevToolsVisible(false);
        this.updateStatus('Download of Drive asset failed.');
        throw new Error('XHR of Drive asset failed');
      });
  }

  fetchDriveAsset(url) {
    return this.fetchTimelineAsset(url, this.setAuthHeaders.bind(this));
  }

  fetchTimelineAsset(url, addRequestHeaders = Function.prototype, method = 'GET', body) {
    this.netReqMuted = false;
    this.loadingStarted = false;
    return this.utils.fetch(url, {
      url, addRequestHeaders: addRequestHeaders.bind(this), method, body,
      onprogress: this.updateProgress.bind(this),
    }, true)
      .then(xhr => {
        if (this.isSplitView) {
          return this.syncView.splitViewTimelineLoaded()
            .then(_ => SyncView.synchronizeRange(SyncView.panels()[0], this.syncView))
            .then(_ => xhr.responseText);
        } else {
          return xhr.responseText;
        }
      })
      .catch((error, xhr) => {
        this.makeDevToolsVisible(false);
        this.updateStatus('Download of asset failed. ' + ((xhr.readyState == xhr.DONE) ? 'CORS headers likely not applied.' : ''));
      });
  }

  setAuthHeaders(xhr) {
    xhr.setRequestHeader('Authorization', `Bearer ${GoogleAuth.getUserAccessToken()}`);
  }

  updateProgress(evt) {
    try {
      this.updateStatus(`Download progress: ${((evt.loaded / this.totalSize) * 100).toFixed(2)}%`);

      UI.inspectorView.showPanel('timeline').then(_ => {
        const panel = Timeline.TimelinePanel.instance();
        // start progress
        if (!this.loadingStarted) {
          this.loadingStarted = true;
          panel && panel.loadingStarted();
        }

        // update progress
        panel && panel.loadingProgress(evt.loaded / (evt.total || this.totalSize));

        // flip off filmstrip or network if theres no data in the trace
        if (!this.netReqMuted) {
          this.netReqMuted = true;
          this.devTools.monkepatchSetMarkers();
        }
      });
    } catch (e) {}
  }

  uploadTimelineData() {
    const panel = Timeline.TimelinePanel.instance();
    const bs = panel._performanceModel._tracingModel.backingStorage();
    return bs._file.read().then(str => {
      this.uploadData(str);
    });
  }

  changeUrl(id) {
    const url = `?loadTimelineFromURL=drive://${id}`;
    if (this.refreshPage) {
      window.location.href = `/${url}`;
    } else {
      const state = {'file_id': id};
      const title = 'Timeline Viewer';
      history.replaceState(state, title, url);
    }
  }
}
