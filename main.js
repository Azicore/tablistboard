
// ページロード時に起動
document.addEventListener('DOMContentLoaded', function() {
	
	// 国際化
	$('.i18n').each(function() {
		var $this = $(this);
		$this.html(browser.i18n.getMessage($this.html().replace(/^__MSG_(.+)__$/, '$1')));
	});
	var i18nTexts = {
		ADD_TAB_BUTTON      : browser.i18n.getMessage('addTabButton'),
		REMOVE_LIST_BUTTON  : browser.i18n.getMessage('removeListButton'),
		NEW_LIST_NAME       : browser.i18n.getMessage('newListName'),
		REMOVE_LIST_CONFIRM : browser.i18n.getMessage('removeListConfirm'),
		CLOSE_TAB_CONFIRM   : browser.i18n.getMessage('closeTabConfirm'),
		TITLE               : browser.i18n.getMessage('title'),
		CONFIG_TITLE        : browser.i18n.getMessage('configTitle'),
		CONFIG_RESET_CONFIRM: browser.i18n.getMessage('configResetConfirm'),
		CONFIG_RESET_DONE   : browser.i18n.getMessage('configResetDone')
	};
	
	// バックグラウンドJSのルートオブジェクトを取得
	var bg = browser.extension.getBackgroundPage();
	
	// アドオン起動直前に開いていたタブのID
	var lastTabId = bg.lastTabId;
	
	// 現在のウィンドウのID
	var currentWindowId = browser.windows.WINDOW_ID_CURRENT;
	
	// このタブのID
	var thisTabId;
	
	// 設定の読み込みと保存
	var Config = (function() {
		// 設定項目の要素
		var $config = {
			wordWrap  : $('#conf_wordwrap'),
			oldTab    : $('#conf_oldtab'),
			oldTabTerm: $('#conf_oldtabterm'),
			lastTab   : $('#conf_lasttab'),
			newTab    : $('#conf_newtab'),
			closeTab  : $('#conf_closetab'),
			removeList: $('#conf_removelist')
		};
		var obj = {
			// 設定を読み込んで設定画面に反映
			load: function() {
				var self = this;
				return browser.storage.local.get().then(function(obj) {
					var config = obj.config || {
						wordWrap   : true,
						oldTab     : true,
						oldTabTerm : 168,
						lastTab    : true,
						newTab     : true,
						closeTab   : true,
						removeList : true
					};
					for (var i in config) {
						var val = self[i] = config[i];
						typeof val == 'boolean' ? $config[i].prop('checked', val) : $config[i].val(val);
					}
					return Promise.resolve();
				});
			},
			// 設定画面の設定を保存
			save: function() {
				var config = {};
				for (var i in $config) {
					this[i] = config[i] = $config[i].attr('type') == 'checkbox' ? $config[i].prop('checked') : $config[i].val();
				}
				return browser.storage.local.set({config: config});
			}
		};
		obj.load();
		return obj;
	})();
	
	// 全てのリストの情報を更新して保存する
	var updateListInfo = function() {
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
		browser.sessions.setWindowValue(currentWindowId, 'windowInfo', { lists: lists });
	};
	
	// 全てのタブの情報を更新して保存する
	var updateTabInfo = function() {
		$('.tablist_block').each(function() {
			var $tablistBlock = $(this);
			var listId = +$tablistBlock.attr('data-list-id');
			var $tabItems = $tablistBlock.find('.tabitem').each(function(i) {
				var $this = $(this);
				var tabId = +$this.attr('data-tab-id');
				browser.sessions.setTabValue(tabId, 'tabInfo', { listId: listId, order: i + 1 });
			});
			$tablistBlock.find('.remove_list_btn').toggle($tabItems.length == 0);
		});
	};
	
	// カラムのHTMLを生成する
	var createColumnElement = function(col) {
		var $column = $('<ul>').addClass('column').sortable({
			connectWith: '.column',
			placeholder: 'tablist_block placeholder',
			opacity: 0.8,
			cursor: 'move',
			handle: '.tablist_title',
			scroll: false,
			revert: 100,
			update: updateListInfo
		});
		for (var i = 0; col.lists.length > i; i++) {
			$column.append(createListElement(col.lists[i]));
		}
		return $('<div>').addClass('column_block').attr('data-col-id', col.colId).append($column);
	};
	
	// リストのHTMLを生成する
	var createListElement = function(list) {
		var $tablist = $('<ul>').addClass('tablist').sortable({
			connectWith: '.tablist',
			placeholder: 'tabitem placeholder',
			opacity: 0.8,
			cursor: 'move',
			scroll: false,
			revert: 100,
			update: updateTabInfo
		});
		for (var i = 0; list.tabs.length > i; i++) {
			$tablist.append(createTabElement(list.tabs[i]))
		}
		var genTextLine = function(cls1, cls2, text) {
			return $('<p>').addClass(cls1).append($('<span>').addClass(cls2).text(text));
		};
		return $('<li>').addClass('tablist_block').attr('data-list-id', list.listId)
			.append(genTextLine('tablist_title', 'tablist_title_text', list.title))
			.append($tablist)
			.append(genTextLine('add_tab_btn', 'add_tab_text', i18nTexts.ADD_TAB_BUTTON))
			.append(genTextLine('remove_list_btn', 'remove_list_text', i18nTexts.REMOVE_LIST_BUTTON))
	};
	
	// タブのHTMLを生成する
	var createTabElement = function(tab) {
		var cls = ['tabitem'];
		if (Config.oldTab && tab.isOld) cls.push('old_tab');
		if (Config.newTab && tab.isNewTab) cls.push('new_tab');
		if (Config.lastTab && tab.id == lastTabId) cls.push('last_tab');
		if (!Config.wordWrap) cls.push('single_line');
		return $('<li>').addClass(cls.join(' ')).attr('data-tab-id', tab.id)
			.append($('<div>').addClass('close_tab_btn'))
			.append($('<img>').addClass('favicon').attr('src', tab.favIconUrl))
			.append($('<span>').addClass('tabitem_text').html(tab.title));
	};
	
	var tabs, cols = [];
	Promise.all([
		bg.getAllTabs(),
		browser.tabs.getCurrent(),
		browser.sessions.getWindowValue(currentWindowId, 'windowInfo')
	]).then(function(obj) {
		// 全てのタブの情報
		tabs = obj[0];
		// このタブの情報
		thisTabId = obj[1].id;
		// ウィンドウに保存した情報
		var lists = (obj[2] || {}).lists;
		// ウインドウに情報がない場合は新規リストを1つ作成
		if (!lists || lists.length == 0) lists = [{ listId: Date.now(), column: 0, order: 1, title: i18nTexts.NEW_LIST_NAME }];
		for (var i = 0; lists.length > i; i++) {
			var colId = lists[i].column;
			if (!cols[colId]) cols[colId] = { colId: colId, lists: [] };
			cols[colId].lists.push(lists[i]);
		}
		// カラムごとにソート
		for (var i = 0; cols.length > i; i++) {
			cols[i].lists.sort(function(a, b) { return a.order > b.order ? 1 : -1; });
		}
		// タブに保存した情報を取得
		var tabInfo = [];
		for (var i = 0; tabs.length > i; i++) {
			if (tabs[i].id == thisTabId) continue;
			tabInfo[i] = browser.sessions.getTabValue(tabs[i].id, 'tabInfo');
		}
		return Promise.all(tabInfo);
	}).then(function(tabInfo) {
		// タブ情報を一つのオブジェクトに集約してリストごとに分類する
		var tabLists = {};
		var defaultListId = cols[0].lists[0].listId;
		var defaultOrder = 1e10;
		var limitTime = Date.now() - Config.oldTabTerm * 36e5;
		for (var i = 0; tabs.length > i; i++) {
			if (tabs[i].id == thisTabId) continue;
			var listId = (tabInfo[i] || {}).listId || defaultListId; // 新規タブ
			var order  = (tabInfo[i] || {}).order || ++defaultOrder;
			tabs[i].listId = listId;
			tabs[i].order  = order;
			if (limitTime > tabs[i].lastAccessed) tabs[i].isOld = true;
			if (order == defaultOrder) tabs[i].isNewTab = true;
			if (!tabLists[listId]) tabLists[listId] = [];
			tabLists[listId].push(tabs[i]);
		}
		// リストごとにソート
		for (var i in tabLists) {
			tabLists[i].sort(function(a, b) { return a.order > b.order ? 1 : -1; });
		}
		// カラム情報とマージしてHTML生成
		for (var i = 0; cols.length > i; i++) {
			var lists = cols[i].lists;
			for (var j = 0; lists.length > j; j++) {
				var listId = lists[j].listId;
				lists[j].tabs = tabLists[listId] || [];
			}
			$('#main').append(createColumnElement(cols[i]));
		}
		updateTabInfo();
		updateListInfo();
	});
	
	// リスト追加ボタン
	$('#add_list').on('click', function() {
		var listId = Date.now();
		var $columns = $('.column_block');
		$columns.last().after(
			createColumnElement({
				colId: $columns.length,
				lists: [{ listId: listId, title: i18nTexts.NEW_LIST_NAME, tabs: [] }]
			})
		);
		updateListInfo();
	});
	// 初期化ボタン
	$('#conf_reset').on('click', function() {
		if (!confirm(i18nTexts.CONFIG_RESET_CONFIRM)) return;
		browser.sessions.removeWindowValue(currentWindowId, 'windowInfo');
		for (var i = 0; tabs.length > i; i++) {
			browser.sessions.removeTabValue(tabs[i].id, 'tabInfo');
		}
		alert(i18nTexts.CONFIG_RESET_DONE);
		bg.switchTab(thisTabId);
	});
	$(document)
	// リスト削除ボタン
	.on('click', '.remove_list_text', function() {
		var $tablistBlock = $(this).parent().parent();
		var listTitle = $tablistBlock.find('.tablist_title').text();
		if (!Config.removeList || confirm(i18nTexts.REMOVE_LIST_CONFIRM.replace('%s', listTitle))) {
			$tablistBlock.remove();
			updateListInfo();
		}
	})
	// タブ追加ボタン
	.on('click', '.add_tab_text', function() {
		var $tablist = $(this).parent().parent().find('.tablist');
		browser.tabs.create({ active: false }).then(function(tab) {
			$tablist.append(createTabElement(tab));
			updateTabInfo();
		});
	})
	// タブ削除ボタン
	.on('click', '.close_tab_btn', function(e) {
		if (!Config.closeTab || confirm(i18nTexts.CLOSE_TAB_CONFIRM)) {
			var $tabitem = $(this).parent();
			bg.switchTab(+$tabitem.attr('data-tab-id'));
			$tabitem.remove();
			updateTabInfo();
		}
		e.stopPropagation();
	})
	// タブ選択
	.on('click', '.tabitem', function() {
		bg.switchTab(thisTabId, +$(this).attr('data-tab-id'));
	})
	// リスト名変更
	.on('click', '.tablist_title_text', function() {
		var $title = $(this).parent();
		var title = $title.text();
		var $input = $('<input type="text">').val(title).on('blur', function() {
			var $this = $(this);
			$title.empty().append($('<span>').addClass('tablist_title_text').text($this.val()));
			$this.remove();
			updateListInfo();
		});
		$title.empty().append($input);
		$input.focus();
	});
	// 設定画面の切り替え
	var toggleConf = function(toggle) {
		$('#main').toggle(!toggle);
		$('#config').toggle(!!toggle);
		$('.header_btn_main').toggle(!toggle);
		$('.header_btn_conf').toggle(!!toggle);
		$('h1').html(toggle ? i18nTexts.CONFIG_TITLE : i18nTexts.TITLE);
	};
	$('#conf_open').on('click', function() {
		toggleConf(true);
	});
	$('#conf_cancel').on('click', function() {
		Config.load().then(function() {
			toggleConf(false);
		});
	});
	$('#conf_ok').on('click', function() {
		Config.save().then(function() {
			toggleConf(false);
			location.reload();
		});
	});

});
