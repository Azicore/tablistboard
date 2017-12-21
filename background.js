
// --------------------------------------------------------------------------------
// # 基本変数

// メインページとサイドバーのHTML
var MAIN_PAGE = {
	ja: 'main_ja.html',
	en: 'main_en.html'
};
var SIDEBAR_PAGE = 'sidebar.html';

// タブリスト情報のキー
var TAB_VALUE_KEY    = 'tabInfo';
var WINDOW_VALUE_KEY = 'windowInfo';

// タブ状態情報のキー
var TAB_STATUS_KEYS = {
	activated: 'tabStatusActivated',
	displayed: 'tabStatusDisplayed'
};

// ウィンドウごとのメインページのタブのID
var mainPageTabIds = {};

// ウィンドウごとのアドオン起動直前に開いていたタブのID
var lastTabIds = {};

// 言語
var lang = browser.i18n.getUILanguage();
lang = /^ja/.test(lang) ? 'ja' : 'en';


// --------------------------------------------------------------------------------
// # バックグラウンド関数

// タブ切り替え
var switchTab = function(windowId, self, target) {
	// 依存変数：mainPageTabIds
	// targetに切り替える
	var procs = [];
	if (target != null && !isNaN(target)) {
		procs.push(browser.tabs.update(target, { active: true }).catch(function() { }));
	}
	// selfを閉じる
	if (self != null && !isNaN(self)) {
		procs.push(browser.tabs.remove(self));
		// メインページを閉じた場合
		if (self == mainPageTabIds[windowId]) {
			mainPageTabIds[windowId] = null;
			// 履歴と最近閉じたタブから削除する
			procs.push(browser.sessions.getRecentlyClosed({ maxResults: 1 }).then(function(sessionInfo) {
				if (sessionInfo[0] && sessionInfo[0].tab) {
					var tab = sessionInfo[0].tab;
					return Promise.all([
						browser.sessions.forgetClosedTab(tab.windowId, tab.sessionId),
						browser.history.deleteUrl({ url: tab.url })
					]);
				}
				return Promise.resolve();
			}));
		}
	}
	return Promise.all(procs);
};

// アクティブなタブを取得
var getActiveTab = function(windowId) {
	// 依存変数：なし
	return new Promise(function(resolve, reject) {
		browser.tabs.query({ active: true, windowId: windowId }).then(function(tabs) {
			resolve(tabs[0].id);
		}, reject);
	});
};

// タブの状態情報をセットする
var setTabStatus = function(tabId, status, value) {
	// 依存変数：TAB_STATUS_KEYS
	var key = TAB_STATUS_KEYS[status];
	value = +value + ''; // '0' or '1'
	return browser.sessions.setTabValue(tabId, key, value);
};

// タブの状態情報を取得する
var getTabStatus = function(tabId) {
	// 依存変数：TAB_STATUS_KEYS
	return Promise.all([
		browser.sessions.getTabValue(tabId, TAB_STATUS_KEYS.activated),
		browser.sessions.getTabValue(tabId, TAB_STATUS_KEYS.displayed)
	]).then(function(obj) {
		return {
			activated: obj[0] ? +obj[0] : 1,
			displayed: obj[1] ? +obj[1] : 1
		};
	});
};

// タブとウィンドウに保存した情報を取得
var getTabListInfo = function(windowId) {
	// 依存変数：TAB_VALUE_KEY, WINDOW_VALUE_KEY, getActiveTab, getTabStatus
	var tabs;
	return Promise.all([
		browser.tabs.query({ windowId: windowId }).then(function(obj) {
			tabs = obj;
			var tabInfo = [], tabStatus = [];
			for (var i = 0; tabs.length > i; i++) {
				tabInfo[i] = browser.sessions.getTabValue(tabs[i].id, TAB_VALUE_KEY);
				tabStatus[i] = getTabStatus(tabs[i].id);
			}
			return Promise.all([
				Promise.all(tabInfo),
				Promise.all(tabStatus)
			]);
		}),
		browser.sessions.getWindowValue(windowId, WINDOW_VALUE_KEY),
		getActiveTab(windowId)
	]).then(function(obj) {
		var lists = null;
		// リスト情報は連想配列に整形して渡す
		if (obj[1] && obj[1].lists && obj[1].lists.length) {
			lists = {};
			for (var i = 0; obj[1].lists.length > i; i++) {
				lists[obj[1].lists[i].listId] = obj[1].lists[i];
			}
		}
		return {
			tabs        : tabs,
			tabInfo     : obj[0][0],
			tabStatus   : obj[0][1],
			lists       : lists,
			currentTabId: obj[2]
		};
	});
};

// タブとウィンドウに保存した情報を全て削除
var removeTabListInfo = function(windowId, onlyStatus) {
	// 依存変数：TAB_VALUE_KEY, WINDOW_VALUE_KEY, TAB_STATUS_KEYS
	return Promise.all([
		browser.tabs.query({ windowId: windowId }).then(function(tabs) {
			var procs = [];
			for (var i = 0; tabs.length > i; i++) {
				if (!onlyStatus) {
					procs.push(browser.sessions.removeTabValue(tabs[i].id, TAB_VALUE_KEY));
				}
				procs.push(
					browser.sessions.removeTabValue(tabs[i].id, TAB_STATUS_KEYS.activated),
					browser.sessions.removeTabValue(tabs[i].id, TAB_STATUS_KEYS.displayed)
				);
			}
			return Promise.all(procs);
		}),
		onlyStatus ? Promise.resolve() : browser.sessions.removeWindowValue(windowId, WINDOW_VALUE_KEY)
	]);
};

// サイドバーのリロード
var reloadSidebar = function() {
	return browser.sidebarAction.setPanel({ panel: SIDEBAR_PAGE + '#' + Date.now() })
};

// 遅延処理
var delay = function(ms) {
	return new Promise(function(resolve, reject) {
		setTimeout(resolve, ms || 200);
	});
};

// メインページ上のハイパーリンク
var openPageFromBoard = function(windowId, url) {
	return switchTab(windowId, mainPageTabIds[windowId], lastTabIds[windowId]).then(function() {
		return browser.tabs.create({ active: true, url: url });
	});
};



// --------------------------------------------------------------------------------
// # 固定共通オブジェクト・関数

// 国際化テキスト
var i18nTexts = {
	ADD_TAB_BUTTON       : browser.i18n.getMessage('addTabButton'),
	REMOVE_LIST_BUTTON   : browser.i18n.getMessage('removeListButton'),
	NEW_LIST_NAME        : browser.i18n.getMessage('newListName'),
	REMOVE_LIST_CONFIRM  : browser.i18n.getMessage('removeListConfirm'),
	CLOSE_TAB_CONFIRM    : browser.i18n.getMessage('closeTabConfirm'),
	TITLE                : browser.i18n.getMessage('title'),
	CONFIG_TITLE         : browser.i18n.getMessage('configTitle'),
	CONFIG_RESET_CONFIRM1: browser.i18n.getMessage('configResetConfirm1'),
	CONFIG_RESET_CONFIRM2: browser.i18n.getMessage('configResetConfirm2'),
	CONFIG_RESET_CONFIRM3: browser.i18n.getMessage('configResetConfirm3'),
	CONFIG_RESET_DONE    : browser.i18n.getMessage('configResetDone'),
	SIDEBAR_ERROR_MAIN   : browser.i18n.getMessage('sidebarErrorMain'),
	SIDEBAR_ERROR_NOINFO : browser.i18n.getMessage('sidebarErrorNoinfo'),
	SIDEBAR_OTHER_LISTS  : browser.i18n.getMessage('sidebarOtherLists'),
	ALERT_OK             : browser.i18n.getMessage('alertOk'),
	CONFIRM_OK           : browser.i18n.getMessage('confirmOk'),
	CONFIRM_CANCEL       : browser.i18n.getMessage('confirmCancel'),
	MENU_MOVE_TO_LIST    : browser.i18n.getMessage('menuMoveToList'),
	MENU_SEPARATE_TAB    : browser.i18n.getMessage('menuSeparateTab'),
	MENU_SEPARATE_ABOVE  : browser.i18n.getMessage('menuSeparateAbove'),
	MENU_SEPARATE_BELOW  : browser.i18n.getMessage('menuSeparateBelow'),
	MENU_SEPARATE_DOMAIN : browser.i18n.getMessage('menuSeparateDomain'),
	MENU_COPY_TEXT       : browser.i18n.getMessage('menuCopyText'),
	MENU_COPY_URL        : browser.i18n.getMessage('menuCopyUrl'),
	MENU_COPY_TITLE      : browser.i18n.getMessage('menuCopyTitle'),
	MENU_COPY_BOTH       : browser.i18n.getMessage('menuCopyBoth'),
	MENU_MOVE_TOP        : browser.i18n.getMessage('menuMoveTop'),
	MENU_MOVE_BOTTOM     : browser.i18n.getMessage('menuMoveBottom'),
	MENU_INSERT_LEFT     : browser.i18n.getMessage('menuInsertLeft'),
	MENU_INSERT_RIGHT    : browser.i18n.getMessage('menuInsertRight'),
	MENU_REPLACE_LEFT    : browser.i18n.getMessage('menuReplaceLeft'),
	MENU_REPLACE_RIGHT   : browser.i18n.getMessage('menuReplaceRight'),
	MENU_MERGE_LIST      : browser.i18n.getMessage('menuMergeList'),
//	MENU_SORT_TITLE      : browser.i18n.getMessage('menuSortTitle'),
//	MENU_SORT_ACCESS     : browser.i18n.getMessage('menuSortAccess'),
	MENU_NO_LIST         : browser.i18n.getMessage('menuNoList'),
	MENU_CANCEL          : browser.i18n.getMessage('menuCancel')
};

// 設定の読み込みと保存
var config = (function() {
	var obj = {};
	var queue = [];
	obj.reload = function() {
		// storageから変数にコピー（初回とリセット時のみ）
		return browser.storage.local.get('config').then(function(o) {
			var config = o.config || {};
			var defaultConfig = {
				wordWrap   : false,
				fontSize   : 'medium',
				theme      : 'default',
				oldTab     : true,
				oldTabTerm : 168,
	//			lastTab    : true,
	//			newTab     : true,
				closeTab   : true,
				removeList : true,
				otherLists : true,
				middleClick: false,
				removeTabs : false,
				tabbarOrder: true
			};
			// 未定義の項目はデフォルト値を適用、未知の設定項目は無視
			for (var i in defaultConfig) {
				obj[i] = config[i] != null ? config[i] : defaultConfig[i];
			}
			// 待機している関数があれば実行
			if (queue) {
				for (var i = 0; queue.length > i; i++) queue[i]();
				queue = null;
			}
		});
	};
	// 与えられた設定をstorageと変数にコピー
	obj.update = function(config) {
		for (var i in config) {
			this[i] = config[i];
		}
		return browser.storage.local.set({config: config});
	};
	// configの準備ができたら実行する関数の登録
	obj.onReady = function(func) {
		queue ? queue.push(func) : func();
	};
	// 初回実行
	obj.reload();
	return obj;
})();

// 全てのリストの情報を更新して保存する
var updateListInfo = function($, windowId) {
	// 依存変数：WINDOW_VALUE_KEY
	var lists = [];
	var colId = 0;
	$('.column_block').each(function() {
		var $columnBlock = $(this);
		var $tablistBlock = $columnBlock.find('.tablist_block');
		// 空のカラムは削除
		if ($tablistBlock.length == 0) {
			$columnBlock.remove();
			return true;
		}
		$tablistBlock.each(function(i) {
			var $this = $(this);
			lists.push({
				listId: +$this.attr('data-list-id'),
				column: colId,
				order : i + 1,
				title : $this.find('.tablist_title').text()
			});
		});
		colId++;
	});
	return browser.sessions.setWindowValue(windowId, WINDOW_VALUE_KEY, { lists: lists });
};

// 全てのタブの情報を更新して保存する
var updateTabInfo = function($, windowId) {
	// 依存変数：TAB_VALUE_KEY, config
	var obj = [];
	$('.tablist_block').each(function() {
		var $tablistBlock = $(this);
		var listId = +$tablistBlock.attr('data-list-id');
		var orderOffset = +$tablistBlock.attr('data-order-offset') || 0;
		var $tabItems = $tablistBlock.find('.tabitem').each(function(i) {
			var $this = $(this);
			var tabId = +$this.attr('data-tab-id');
			obj.push(browser.sessions.setTabValue(tabId, TAB_VALUE_KEY, {
				listId: listId,
				order: i + 1 + orderOffset
			}));
		});
		$tablistBlock.find('.remove_list_btn').toggle(config.removeTabs || $tabItems.length == 0);
	});
	return Promise.all(obj);
};


// --------------------------------------------------------------------------------
// # 動作定義

// メインページの起動
var start = function(toggle) {
	// 依存変数：switchTab, getActiveTab, mainPageTabIds, lastTabIds, MAIN_PAGE, lang
	var windowId;
	// 現在のウィンドウとタブを取得
	browser.windows.getCurrent().then(function(window) {
		windowId = window.id;
		return getActiveTab(windowId);
	}).then(function(currentTabId) {
		// メインページで再び起動しようとした場合
		if (mainPageTabIds[windowId] != null && currentTabId == mainPageTabIds[windowId]) {
			// ショートカットの場合は最後のタブに戻り、アドオンボタンの場合は何もしない
			if (toggle) switchTab(windowId, mainPageTabIds[windowId], lastTabIds[windowId]);
		} else {
			lastTabIds[windowId] = currentTabId;
			// メインページのタブを再利用できる場合は再利用
			(mainPageTabIds[windowId] == null
				? Promise.reject()
				: browser.tabs.update(mainPageTabIds[windowId], { url: MAIN_PAGE[lang], active: true })
			// 再利用できない場合（通常）は新規タブでメインページを開く
			).catch(function() {
				start.processing = true;
				browser.tabs.create({ url: MAIN_PAGE[lang] }).then(function(tab) {
					mainPageTabIds[windowId] = tab.id;
				});
			});
		}
	});
};

// 新しいタブが開いたとき
browser.tabs.onCreated.addListener(function(tab) {
	Promise.all([
		setTabStatus(tab.id, 'activated', false),
		setTabStatus(tab.id, 'displayed', false)
	]).then(function() {
		if (!tab.openerTabId) return;
		return browser.sessions.getTabValue(tab.openerTabId, TAB_VALUE_KEY).then(function(tabInfo) {
			if (!tabInfo) return;
			return browser.sessions.setTabValue(tab.id, TAB_VALUE_KEY, {
				listId: tabInfo.listId,
				order : (tabInfo.order + Math.floor(tabInfo.order + 1)) / 2
			});
		});
	}).then(function() {
		browser.runtime.sendMessage({ name: 'created', param: tab });
	});
});

// タブが切り替わったとき
browser.tabs.onActivated.addListener(function(obj) {
	// ※APIのバグにより、obj.tabIdはまれに不正確なため使用不可。
	getActiveTab(obj.windowId).then(function(tabId) {
		return setTabStatus(tabId, 'activated', true);
	}).then(function() {
		browser.runtime.sendMessage({ name: 'activated', param: obj });
	});
});

// タブが別のウィンドウから移動されたとき
browser.tabs.onAttached.addListener(function(tabId, obj) {
	// ※APIのバグにより、tabIdはまれに不正確なため使用不可。
	var tab;
	browser.tabs.query({ windowId: obj.newWindowId, index: obj.newPosition }).then(function(tabs) {
		tab = tabs[0];
		return setTabStatus(tab.id, 'displayed', false);
	}).then(function() {
		browser.runtime.sendMessage({ name: 'created', param: tab });
	});
});


// アドオンボタンのクリック
browser.browserAction.onClicked.addListener(function() {
	start(false);
});

// キーボードショートカット
browser.commands.onCommand.addListener(function(command) {
	if (command == 'start') start(true);
});

