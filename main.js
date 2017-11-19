
// ページロード時に起動
window.jQuery(function($) {
	'use strict';
	
	// --------------------------------------------------------------------------------
	// # 基本変数と初期化
	
	// バックグラウンドJSのルートオブジェクトを取得
	var bg = browser.extension.getBackgroundPage();
	
	// メインページとサイドバーとの動作切り替え
	var isSidebar = location.href.indexOf(bg.SIDEBAR_PAGE) >= 0;
	
	// 現在のウィンドウのID（起動時に取得）
	var currentWindowId;
	
	// 国際化テキスト
	var i18nTexts = bg.i18nTexts;
	
	// 国際化
//	$('.i18n').each(function() {
//		var $this = $(this);
//		$this.html(browser.i18n.getMessage($this.html().replace(/^__MSG_(.+)__$/, '$1')));
//	});
	
	
	// --------------------------------------------------------------------------------
	// # 共通関数
	
	// 全てのリストの情報を更新して保存する
	var updateListInfo = function() {
		return bg.updateListInfo($, currentWindowId);
	};
	
	// 全てのタブの情報を更新して保存する
	var updateTabInfo = function() {
		return bg.updateTabInfo($, currentWindowId);
	};
	
	// カラムのHTMLを生成する
	var createColumnElement = function(col) {
		// 依存変数：updateListInfo
		// col = {
		//     colId: <Number>, // カラムID
		//     lists: <Array>   // listの配列
		// }
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
		// 依存変数：updateTabInfo, i18nTexts
		// list = {
		//     listId: <Number>, // リストID
		//     title : <String>, // リスト名
		//     tabs  : <Array>   // tabの配列
		// }
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
		// 依存変数：bg.config
		// tab = {
		//     id        : <Number>,  // タブID
		//     title     : <String>,  // タブのタイトル
		//     favIconUrl: <String>,  // faviconのURL
		//     isOldTab  : <Boolean>, // 一定期間アクセスしていないタブかどうか
		//     isNewTab  : <Boolean>, // 最近新しく開いたタブかどうか
		//     isLastTab : <Boolean>, // 直前に開いていたタブかどうか
		//     isCurrTab : <Boolean>  // 現在開いているタブかどうか
		// }
		var config = bg.config;
		var cls = ['tabitem'];
		if (config.oldTab && tab.isOldTab) cls.push('old_tab');
		if (tab.isNewTab) cls.push('new_tab');
		if (tab.isLastTab) cls.push('last_tab');
		if (tab.isCurrTab) cls.push('current_tab');
		if (!config.wordWrap) cls.push('single_line');
		return $('<li>').addClass(cls.join(' ')).attr('data-tab-id', tab.id).attr('title', tab.url)
			.append($('<div>').addClass('close_tab_btn'))
			.append($('<img>').addClass('favicon').attr('src', tab.favIconUrl))
			.append($('<span>').addClass('tabitem_text').text(tab.title));
	};
	
	// サイドバー内の他リストのHTMLを生成する
	var createOtherListsElement = function(otherLists) {
		// 依存変数： i18nTexts, bg.config
		var $otherLists = $('<ul>');
		var cls = 'listitem' + (!bg.config.wordWrap ? ' single_line' : '');
		for (var i in otherLists) {
			$otherLists.append($('<li>').addClass(cls).text(otherLists[i].title + ' (' + otherLists[i].num + ')').attr('data-tab-id', otherLists[i].latestTabId));
		}
		return $('<li>').attr('id', 'otherlist_block').append($('<p>').html(i18nTexts.SIDEBAR_OTHER_LISTS)).append($otherLists);
	};
	
	// フォントサイズを設定する
	$.fn.setFontSize = function() {
		return $(this).removeClass(function(i, cls) {
			return cls.split(/ +/).filter(function(s) { return /^fontsize_/.test(s); }).join(' ');
		}).addClass('fontsize_' + bg.config.fontSize);
	};
	
	
	// --------------------------------------------------------------------------------
	// # メイン処理
	
	// メインページのタブ一覧生成
	var generateMainBoard = function() {
		bg.getTabListInfo(currentWindowId, function(tabs, tabInfo, lists) {
			var lastTabId     = bg.lastTabIds[currentWindowId];
			var mainPageTabId = bg.mainPageTabIds[currentWindowId];
			var orderFunc = function(a, b) { return a.order > b.order ? 1 : -1; };
			// ウィンドウに情報がない場合は新規リストを1つ作成
			if (!lists || lists.length == 0) {
				lists = [{ listId: Date.now(), column: 0, order: 1, title: i18nTexts.NEW_LIST_NAME }];
			}
			// カラムごとにリストを分類
			var cols = [];
			lists.isExistent = {};
			for (var i = 0; lists.length > i; i++) {
				var colId = lists[i].column;
				if (!cols[colId]) cols[colId] = { colId: colId, lists: [] };
				cols[colId].lists.push(lists[i]);
				lists.isExistent[lists[i].listId] = true;
			}
			// カラムごとにリストをソート
			for (var i = 0; cols.length > i; i++) {
				cols[i].lists.sort(orderFunc);
			}
			// リストごとにタブを分類
			var tabLists = {};
			var defaultListId = cols[0].lists[0].listId;
			var defaultOrder = 1e10;
			var limitTime = Date.now() - bg.config.oldTabTerm * 36e5;
			for (var i = 0; tabs.length > i; i++) {
				if (tabs[i].id == mainPageTabId) continue;
				var listId = (tabInfo[i] || {}).listId || defaultListId;
				var order  = (tabInfo[i] || {}).order  || defaultOrder;
				if (!lists.isExistent[listId]) listId = defaultListId;
				tabs[i].listId    = listId;
				tabs[i].order     = order;
				tabs[i].isOldTab  = limitTime > tabs[i].lastAccessed;
				tabs[i].isNewTab  = order == defaultOrder;
				tabs[i].isLastTab = tabs[i].id == lastTabId;
				if (!tabLists[listId]) tabLists[listId] = [];
				tabLists[listId].push(tabs[i]);
			}
			// リストごとにタブをソート
			for (var i in tabLists) {
				tabLists[i].sort(orderFunc);
			}
			// HTML生成
			var $main = $('#main').setFontSize();
			for (var i = 0; cols.length > i; i++) {
				var lists = cols[i].lists;
				for (var j = 0; lists.length > j; j++) {
					var listId = lists[j].listId;
					lists[j].tabs = tabLists[listId] || [];
				}
				$main.append(createColumnElement(cols[i]));
			}
			updateTabInfo();
			updateListInfo();
		});
	};
	
	// サイドバーでのタブ一覧生成
	var generateSidebar = function(currentTabId, func) {
		bg.getTabListInfo(currentWindowId, function(tabs, tabInfo, lists) {
			var mainPageTabId = bg.mainPageTabIds[currentWindowId];
			var orderFunc = function(a, b) { return a.order > b.order ? 1 : -1; };
			// 画面表示
			var display = function(obj) {
				var isError = typeof obj == 'string';
				$('#sidebar').empty().toggle(!isError).append(isError ? '' : obj).setFontSize();
				$('#sidebar_msg').toggle(isError).html(isError ? obj : '');
				//$('#sidebar_msg').toggle(isError).html(isError ? obj + '<br><br>現在 ' + tabs.length + ' 枚のタブを開いています。' : '');
				
				if (typeof func == 'function') func();
			};
			// メインページを表示中の場合
			if (currentTabId != null && currentTabId == mainPageTabId) {
				return display(i18nTexts.SIDEBAR_ERROR_MAIN);
			}
			// ウィンドウに情報がない場合
			if (!lists || lists.length == 0 || currentTabId == null) {
				return display(i18nTexts.SIDEBAR_ERROR_NOINFO);
			}
			// 対象のリストを特定
			var targetListId;
			for (var i = 0; tabs.length > i; i++) {
				if (tabs[i].id == currentTabId) {
					targetListId = (tabInfo[i] || {}).listId;
					break;
				}
			}
			if (targetListId == null) {
				return display(i18nTexts.SIDEBAR_ERROR_NOINFO);
			}
			// 対象リストのタブを集約
			var tabList = [];
			var otherLists = {};
			var defaultOrder = 1e10;
			var limitTime = Date.now() - bg.config.oldTabTerm * 36e5;
			for (var i = 0; tabs.length > i; i++) {
				if (tabs[i].id == mainPageTabId) continue;
				var listId = (tabInfo[i] || {}).listId;
				// 他の各リストの最新のタブを集約
				if (listId != targetListId) {
					if (!otherLists[listId]) otherLists[listId] = { lastAccessed: 0, num: 0 };
					otherLists[listId].num++;
					if (tabs[i].lastAccessed > otherLists[listId].lastAccessed) {
						otherLists[listId].lastAccessed = tabs[i].lastAccessed;
						otherLists[listId].latestTabId = tabs[i].id;
					}
					continue;
				}
				var order = (tabInfo[i] || {}).order || defaultOrder;
				tabs[i].listId    = listId;
				tabs[i].order     = order;
				tabs[i].isOldTab  = limitTime > tabs[i].lastAccessed;
				tabs[i].isNewTab  = order == defaultOrder || order % 1 > 0;
				tabs[i].isCurrTab = tabs[i].id == currentTabId;
				tabList.push(tabs[i]);
			}
			// タブをソート
			tabList.sort(orderFunc);
			// HTML生成
			var elements = [];
			for (var i = 0; lists.length > i; i++) {
				var listId = lists[i].listId;
				if (listId == targetListId) {
					lists[i].tabs = tabList;
					elements.push(createListElement(lists[i]));
				} else if (otherLists[listId]) {
					otherLists[listId].title = lists[i].title;
				}
			}
			if (bg.config.otherLists) elements.push(createOtherListsElement(otherLists));
			return display(elements);
		});
	};
	
	// ウィンドウIDを取得して起動
	browser.windows.getCurrent().then(function(window) {
		currentWindowId = window.id;
		
		// メインページの場合
		if (!isSidebar) {
			generateMainBoard();
			return;
		}
		
		// サイドバーの場合
		var getActiveTab = function() {
			return bg.getActiveTab(currentWindowId);
		};
		getActiveTab().then(function(tabId) {
			generateSidebar(tabId);
		});
		// タブが切り替わったとき
		browser.tabs.onActivated.addListener(function(obj) {
			// ※obj.tabIdはまれに不正確なため使用不可。
			if (obj.windowId != currentWindowId) return;
			getActiveTab().then(function(tabId) {
				generateSidebar(tabId, updateTabInfo);
			});
		});
		// タブが更新されたとき
		browser.tabs.onUpdated.addListener(function(tabId, obj, tab) {
			if (!obj.url && !obj.title || tab.windowId != currentWindowId) return;
			getActiveTab().then(function(tabId) {
				setTimeout(function() { generateSidebar(tabId); }, 200);
			});
		});
		// タブが閉じられたとき
		browser.tabs.onRemoved.addListener(function(tabId, obj) {
			if (obj.windowId != currentWindowId) return;
			getActiveTab().then(function(tabId) {
				setTimeout(function() { generateSidebar(tabId); }, 200);
			});
		});
	
	});
	
	// カラーテーマの設定
	bg.config.theme != 'default' && $('head').append($('<link>').attr({
		rel : 'stylesheet',
		href: 'css/theme_' + bg.config.theme + '.css'
	}));
	
	
	// --------------------------------------------------------------------------------
	// # 各種イベント
	
	// 初期化ボタン
	$('#conf_reset').on('click', function(e) {
		if (e.shiftKey && e.ctrlKey) {
			browser.storage.local.remove(['config', 'update']); // ## For debug
			return;
		}
		if (!confirm(i18nTexts.CONFIG_RESET_CONFIRM)) return;
		bg.removeTabListInfo(currentWindowId, function() {
			alert(i18nTexts.CONFIG_RESET_DONE);
			bg.switchTab(currentWindowId, bg.mainPageTabIds[currentWindowId]);
		});
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
	
	// リスト削除ボタン
	$(document).on('click', '.remove_list_text', function() {
		var $tablistBlock = $(this).parent().parent();
		var listTitle = $tablistBlock.find('.tablist_title').text();
		if (!bg.config.removeList || confirm(i18nTexts.REMOVE_LIST_CONFIRM.replace('%s', listTitle))) {
			$tablistBlock.remove();
			updateListInfo();
		}
	});
	
	// タブ追加ボタン
	$(document).on('click', '.add_tab_text', function() {
		var $tablist = $(this).parent().parent().find('.tablist');
		browser.tabs.create({ active: false }).then(function(tab) {
			$tablist.append(createTabElement(tab));
			updateTabInfo();
		});
	});
	
	// タブ削除ボタン
	$(document).on('click', '.close_tab_btn', function(e) {
		var $tabitem = $(this).parent();
		if (!bg.config.closeTab || confirm(i18nTexts.CLOSE_TAB_CONFIRM.replace('%s', $tabitem.find('.tabitem_text').text()))) {
			bg.switchTab(currentWindowId, +$tabitem.attr('data-tab-id'));
			$tabitem.remove();
			updateTabInfo();
		}
		e.stopPropagation();
	});
	
	// タブ選択
	$(document).on('click', '.tabitem, .listitem', function(e) {
		bg.switchTab(currentWindowId, bg.mainPageTabIds[currentWindowId], +$(this).attr('data-tab-id'));
	}).on('mousedown', '.tabitem, .listitem', function(e) {
		if (bg.config.middleClick && e.which == 2) { // 中クリックでタブ削除
			$(this).find('.close_tab_btn').trigger('click');
			e.preventDefault();
		}
	});
	
	// リスト名変更
	$(document).on('click', '.tablist_title_text', function() {
		if (isSidebar) return;
		var $title = $(this).parent();
		var title = $title.text();
		var $input = $('<input type="text">').val(title).on('blur', function() {
			var $this = $(this);
			var newTitle = $this.val();
			$title.empty().append($('<span>').addClass('tablist_title_text').text(newTitle !== '' ? newTitle : title));
			$this.remove();
			updateListInfo();
		});
		$title.empty().append($input);
		$input.focus();
	});
	
	
	// --------------------------------------------------------------------------------
	// # 設定画面
	
	// 設定の読み込みと保存
	(function() {
		// 設定項目の要素
		var $config = {
			wordWrap   : $('#conf_wordwrap'),
			theme      : $('#conf_theme'),
			fontSize   : $('#conf_fontsize'),
			oldTab     : $('#conf_oldtab'),
			oldTabTerm : $('#conf_oldtabterm'),
//			lastTab    : $('#conf_lasttab'),
//			newTab     : $('#conf_newtab'),
			closeTab   : $('#conf_closetab'),
			removeList : $('#conf_removelist'),
			otherLists : $('#conf_otherlists'),
			middleClick: $('#conf_middleclick')
		};
		// 設定を読み込んで設定画面に反映
		var loadConf = function() {
			for (var i in bg.config) {
				if (!$config[i]) continue;
				var val = bg.config[i];
				typeof val == 'boolean' ? $config[i].prop('checked', val) : $config[i].val(val);
			}
		};
		// 設定画面の切り替え
		var toggleConf = function(toggle) {
			$('#main, .header_btn_main').toggle(!toggle);
			$('#config, .header_btn_conf').toggle(!!toggle);
			$('h1').html(toggle ? i18nTexts.CONFIG_TITLE : i18nTexts.TITLE);
		};
		// 設定ボタン
		$('#conf_open').on('click', function() {
			toggleConf(true);
		});
		// キャンセルボタン
		$('#conf_cancel').on('click', function() {
			loadConf();
			toggleConf(false);
		});
		// 保存ボタン
		$('#conf_ok').on('click', function() {
			var config = {};
			for (var i in $config) {
				config[i] = $config[i].attr('type') == 'checkbox' ? $config[i].prop('checked') : $config[i].val();
			}
			bg.config.update(config).then(function() {
				toggleConf(false);
				location.reload();
				browser.sidebarAction.setPanel({
					panel: bg.SIDEBAR_PAGE + '#' + Date.now()
				});
			});
		});
		// 初期化
		loadConf();
	})();
	
	
	// --------------------------------------------------------------------------------
	// # その他
	
	// 更新情報を表示
	browser.storage.local.get('update').then(function(o) {
		var infoVer = (o.update || { infoVer: '0.0.0' }).infoVer;
		var $info = $('.info');
		$info.each(function() {
			var $this = $(this);
			var $infoClose = $this.find('.info_close');
			var newInfoVer = $this.attr('data-info-ver');
			$this.toggle(newInfoVer > infoVer).on({
				mouseenter: function() { $infoClose.show(); },
				mouseleave: function() { $infoClose.hide(); }
			});
			$infoClose.on('click', function() {
				if (newInfoVer > infoVer) {
					browser.storage.local.set({
						update: { infoVer: newInfoVer }
					});
					infoVer = newInfoVer;
				}
				$this.addClass('info_closing');
				setTimeout(function() { $this.hide(); }, 600);
			});
		});

	});


});
