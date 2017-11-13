
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
	if (target != null) browser.tabs.update(target, { active: true });
	// selfを閉じる
	if (self != null) {
		browser.tabs.remove(self);
		// メインページを閉じた場合は変数をnullにセット
		if (self == mainPageTabIds[windowId]) mainPageTabIds[windowId] = null;
	}
};

// タブとウィンドウに保存した情報を取得
var getTabListInfo = function(windowId, callback) {
	// 依存変数：TAB_VALUE_KEY, WINDOW_VALUE_KEY
	var tabs;
	Promise.all([
		browser.tabs.query({ windowId: windowId }).then(function(obj) {
			tabs = obj;
			var tabInfo = [];
			for (var i = 0; tabs.length > i; i++) {
				tabInfo[i] = browser.sessions.getTabValue(tabs[i].id, TAB_VALUE_KEY);
			}
			return Promise.all(tabInfo);
		}),
		browser.sessions.getWindowValue(windowId, WINDOW_VALUE_KEY)
	]).then(function(obj) {
		callback(tabs, obj[0], (obj[1] || {}).lists);
	});
};

// タブとウィンドウに保存した情報を全て削除
var removeTabListInfo = function(windowId, callback) {
	// 依存変数：TAB_VALUE_KEY, WINDOW_VALUE_KEY
	Promise.all([
		browser.tabs.query({ windowId: windowId }).then(function(tabs) {
			var objs = [];
			for (var i = 0; tabs.length > i; i++) {
				objs[i] = browser.sessions.removeTabValue(tabs[i].id, TAB_VALUE_KEY);
			}
			return Promise.all(objs);
		}),
		browser.sessions.removeWindowValue(windowId, WINDOW_VALUE_KEY)
	]).then(function(obj) {
		callback();
	});
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


// --------------------------------------------------------------------------------
// # 固定共通オブジェクト・関数

// 国際化テキスト
var i18nTexts = {
	ADD_TAB_BUTTON      : browser.i18n.getMessage('addTabButton'),
	REMOVE_LIST_BUTTON  : browser.i18n.getMessage('removeListButton'),
	NEW_LIST_NAME       : browser.i18n.getMessage('newListName'),
	REMOVE_LIST_CONFIRM : browser.i18n.getMessage('removeListConfirm'),
	CLOSE_TAB_CONFIRM   : browser.i18n.getMessage('closeTabConfirm'),
	TITLE               : browser.i18n.getMessage('title'),
	CONFIG_TITLE        : browser.i18n.getMessage('configTitle'),
	CONFIG_RESET_CONFIRM: browser.i18n.getMessage('configResetConfirm'),
	CONFIG_RESET_DONE   : browser.i18n.getMessage('configResetDone'),
	SIDEBAR_ERROR_MAIN  : browser.i18n.getMessage('sidebarErrorMain'),
	SIDEBAR_ERROR_NOINFO: browser.i18n.getMessage('sidebarErrorNoinfo')
};

// 設定の読み込みと保存
var config = (function() {
	var obj = {};
	// storageから変数にコピー（初回のみ）
	browser.storage.local.get('config').then(function(o) {
		var config = o.config || {
			wordWrap   : true,
			oldTab     : true,
			oldTabTerm : 168,
			lastTab    : true,
			newTab     : true,
			closeTab   : true,
			removeList : true,
			infoVer    : '0.0.0'
		};
		for (var i in config) {
			obj[i] = config[i];
		}
	});
	// 与えられた設定をstorageと変数にコピー
	obj.update = function(config) {
		for (var i in config) {
			this[i] = config[i];
		}
		return browser.storage.local.set({config: config});
	};
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
	browser.sessions.setWindowValue(windowId, WINDOW_VALUE_KEY, { lists: lists });
};

// 全てのタブの情報を更新して保存する
var updateTabInfo = function($, windowId) {
	// 依存変数：TAB_VALUE_KEY
	$('.tablist_block').each(function() {
		var $tablistBlock = $(this);
		var listId = +$tablistBlock.attr('data-list-id');
		var $tabItems = $tablistBlock.find('.tabitem').each(function(i) {
			var $this = $(this);
			var tabId = +$this.attr('data-tab-id');
			browser.sessions.setTabValue(tabId, TAB_VALUE_KEY, {
				listId: listId,
				order: i + 1
			});
		});
		$tablistBlock.find('.remove_list_btn').toggle($tabItems.length == 0);
	});
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
				browser.tabs.create({ url: MAIN_PAGE[lang] }).then(function(tab) {
					mainPageTabIds[windowId] = tab.id;
				});
			});
		}
	});
};

// 新しいタブが開いたとき
browser.tabs.onCreated.addListener(function(tab) {
	if (!tab.openerTabId) return;
	browser.sessions.getTabValue(tab.openerTabId, TAB_VALUE_KEY).then(function(tabInfo) {
		if (tabInfo) {
			browser.sessions.setTabValue(tab.id, TAB_VALUE_KEY, {
				listId: tabInfo.listId,
				order : (tabInfo.order + Math.floor(tabInfo.order + 1)) / 2
			});
		}
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

