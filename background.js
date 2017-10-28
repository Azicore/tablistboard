
// メインページ
var mainPage = 'index.html';

// メインページのタブのID
var mainPageTabId = null;

// アドオン起動直前に開いていたタブのID
var lastTabId;

// タブ切り替え（targetに切り替えて、selfを閉じる）
var switchTab = function(self, target) {
	if (target != null) browser.tabs.update(target, { active: true });
	browser.tabs.remove(self);
	// メインページを閉じた場合は変数をnullにセット
	if (self == mainPageTabId) mainPageTabId = null;
};

// タブ情報取得
var getAllTabs = function() {
	return browser.tabs.query({ currentWindow: true });
};

// アドオンの起動
var start = function(toggle) {
	// 起動直前に開いていたタブのIDを取得
	browser.tabs.query({ active: true, currentWindow: true }).then(function(tab) {
		// メインページで再び起動しようとした場合
		if (tab[0].id == mainPageTabId) {
			// ショートカットの場合は最後のタブに戻り、アドオンボタンの場合は何もしない
			if (toggle) switchTab(mainPageTabId, lastTabId);
		} else {
			lastTabId = tab[0].id;
			// メインページがまだ起動していない場合
			if (mainPageTabId == null) {
				// 新規タブでメインページを開く
				browser.tabs.create({
					url: mainPage,
				}).then(function(tab) {
					mainPageTabId = tab.id;
				});
			// メインページがすでに起動している場合
			} else {
				// タブを再利用する
				browser.tabs.update(mainPageTabId, { url: mainPage, active: true });
			}
		}
	});
};

// 既知のタブから開いた場合は同じリストIDを保持
browser.tabs.onCreated.addListener(function(tab) {
	if (tab.openerTabId != null) {
		browser.sessions.getTabValue(tab.openerTabId, 'tabInfo').then(function(tabInfo) {
			if (tabInfo) browser.sessions.setTabValue(tab.id, 'tabInfo', { listId: tabInfo.listId });
		});
	}
});

// アドオンボタンのクリック
chrome.browserAction.onClicked.addListener(function() {
	start(false);
});

// キーボードショートカット
browser.commands.onCommand.addListener(function(command) {
	if (command == 'start') start(true);
});

