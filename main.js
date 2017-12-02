
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
	
	// HTMLエスケープ
	var escapeHtml = function(str) {
		var r = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
		return str.replace(/[<>&"]/g, function(s) { return r[s]; });
	};
	
	// タブバーのタブの並び順を更新する
	var updateTabbarOrder = function() {
		if (!bg.config.tabbarOrder) return;
		var tabIds = [];
		$('.tabitem').each(function() {
			tabIds.push(+$(this).attr('data-tab-id'));
		});
		return tabIds.length > 0 && browser.tabs.get(tabIds[0]).then(function(tab) {
			return browser.tabs.move(tabIds, { windowId: currentWindowId, index: tab.index });
		});
	};
	
	// 全てのリストの情報を更新して保存する
	var updateListInfo = function() {
		return bg.updateListInfo($, currentWindowId).then(updateTabbarOrder);
	};
	
	// 全てのタブの情報を更新して保存する
	var updateTabInfo = function() {
		return bg.updateTabInfo($, currentWindowId).then(updateTabbarOrder);
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
		var otherListsArr = [];
		for (var i in otherLists) {
			otherListsArr.push(otherLists[i]);
		}
		otherListsArr.sort(function(a, b) { return a.title > b.title ? 1 : -1; });
		for (var i = 0; otherListsArr.length > i; i++) {
			$otherLists.append($('<li>').addClass(cls).text(otherListsArr[i].title + ' (' + otherListsArr[i].num + ')').attr('data-tab-id', otherListsArr[i].latestTabId));
		}
		return $('<li>').attr('id', 'otherlist_block').append($('<p>').addClass('tablist_title').html(i18nTexts.SIDEBAR_OTHER_LISTS)).append($otherLists);
	};
	
	// フォントサイズを設定する
	$.fn.setFontSize = function() {
		return $(this).removeClass(function(i, cls) {
			return cls.split(/ +/).filter(function(s) { return /^fontsize_/.test(s); }).join(' ');
		}).addClass('fontsize_' + bg.config.fontSize);
	};
	
	// ダイアログ表示
	var Dialog = {
		_create: function(msg, isConfirm) {
			var self = this;
			return new Promise(function(resolve, reject) {
				self.close = function(status) {
					$(document).off('keydown', esc);
					$modalMask.remove();
					status ? resolve() : reject();
				};
				var ok     = function() { self.close(true); };
				var cancel = function() { self.close(!isConfirm); };
				var esc    = function(e) { if (e.which == 27) cancel(); }; // Escキーでキャンセル
				var $buttons = $('<div>');
				if (isConfirm) {
					$buttons.append($('<button>').text(i18nTexts.CONFIRM_OK).on('click', ok));
					$buttons.append($('<button>').text(i18nTexts.CONFIRM_CANCEL).on('click', cancel));
				} else {
					$buttons.append($('<button>').text(i18nTexts.ALERT_OK).on('click', ok));
				}
				var $dialogBody = $('<div>').append($('<p>').html(msg)).append($buttons).hide().on('click', false);
				var $modalMask = $('<div>').addClass('dialog').append($dialogBody).on('click', cancel);
				$('body').append($modalMask);
				$dialogBody.slideDown(200).find('button').eq(0).focus();
				$(document).on('keydown', esc);
			});
		},
		alert: function(msg) {
			return this._create(msg, false);
		},
		confirm: function(msg, force) {
			return force === true ? Promise.resolve() : this._create(msg, true);
		},
		close: function() { }
	};
	
	
	// --------------------------------------------------------------------------------
	// # メイン処理
	
	// メインページのタブ一覧生成
	var generateMainBoard = function() {
		return bg.getTabListInfo(currentWindowId).then(function(o) {
			var {tabs, tabInfo, tabStatus, lists} = o;
			var lastTabId     = bg.lastTabIds[currentWindowId];
			var mainPageTabId = bg.mainPageTabIds[currentWindowId];
			var orderFunc = function(a, b) { return a.order > b.order ? 1 : -1; };
			// ウィンドウに情報がない場合は新規リストを1つ作成
			if (!lists) {
				lists = {};
				var newList = { listId: Date.now(), column: 0, order: 1, title: i18nTexts.NEW_LIST_NAME };
				lists[newList.listId] = newList;
			}
			// カラムごとにリストを分類
			var cols = [];
			for (var listId in lists) {
				var colId = lists[listId].column;
				if (!cols[colId]) cols[colId] = { colId: colId, lists: [] };
				cols[colId].lists.push(lists[listId]);
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
			var procs = [];
			for (var i = 0; tabs.length > i; i++) {
				if (tabs[i].id == mainPageTabId) continue;
				var listId = tabInfo[i] && tabInfo[i].listId || defaultListId;
				var order = tabInfo[i] && tabInfo[i].order || defaultOrder;
				if (!lists[listId]) listId = defaultListId;
				tabs[i].listId    = listId;
				tabs[i].order     = order;
				tabs[i].isOldTab  = limitTime > tabs[i].lastAccessed;
				tabs[i].isNewTab  = !tabStatus[i].activated || !tabStatus[i].displayed;
				tabs[i].isLastTab = tabs[i].id == lastTabId;
				if (!tabLists[listId]) tabLists[listId] = [];
				tabLists[listId].push(tabs[i]);
				procs.push(bg.setTabStatus(tabs[i].id, 'displayed', true));
			}
			// リストごとにタブをソート
			for (var i in tabLists) {
				tabLists[i].sort(orderFunc);
			}
			// HTML生成
			var $main = $('#main').setFontSize();
			for (var i = 0; cols.length > i; i++) {
				for (var j = 0; cols[i].lists.length > j; j++) {
					cols[i].lists[j].tabs = tabLists[cols[i].lists[j].listId] || [];
				}
				$main.append(createColumnElement(cols[i]));
			}
			return Promise.all([updateTabInfo(), updateListInfo(), Promise.all(procs)]);
		});
	};
	
	// サイドバーでのタブ一覧生成
	var generateSidebar = function(delay) {
		return bg.getTabListInfo(currentWindowId).then(function(o) {
			var {tabs, tabInfo, tabStatus, lists, currentTabId} = o;
			var mainPageTabId = bg.mainPageTabIds[currentWindowId];
			var orderFunc = function(a, b) { return a.order > b.order ? 1 : -1; };
			// メインページを表示中の場合
			if (currentTabId != null && currentTabId == mainPageTabId) {
				return i18nTexts.SIDEBAR_ERROR_MAIN;
			}
			// ウィンドウに情報がない場合
			if (!lists || currentTabId == null) {
				return i18nTexts.SIDEBAR_ERROR_NOINFO;
			}
			// 対象のリストを特定
			var targetListId;
			for (var i = 0; tabs.length > i; i++) {
				if (tabs[i].id == currentTabId) {
					targetListId = tabInfo[i] && tabInfo[i].listId;
					break;
				}
			}
			if (!lists[targetListId]) {
				return i18nTexts.SIDEBAR_ERROR_NOINFO;
			}
			// タブの情報を集約
			var tabList = [];
			var otherLists = {};
			var defaultOrder = 1e10;
			var limitTime = Date.now() - bg.config.oldTabTerm * 36e5;
			var procs = [];
			for (var i = 0; tabs.length > i; i++) {
				if (tabs[i].id == mainPageTabId) continue;
				var listId = tabInfo[i] && tabInfo[i].listId;
				// 対象リストのタブ
				if (listId == targetListId) {
					var order = tabInfo[i] && tabInfo[i].order || defaultOrder;
					tabs[i].listId    = listId;
					tabs[i].order     = order;
					tabs[i].isOldTab  = limitTime > tabs[i].lastAccessed;
					tabs[i].isNewTab  = !tabStatus[i].activated || !tabStatus[i].displayed;
					tabs[i].isCurrTab = tabs[i].id == currentTabId;
					tabList.push(tabs[i]);
					procs.push(bg.setTabStatus(tabs[i].id, 'displayed', true));
				// 他のリストのタブ
				} else {
					if (!otherLists[listId]) otherLists[listId] = { lastAccessed: 0, num: 0 };
					otherLists[listId].num++;
					if (tabs[i].lastAccessed > otherLists[listId].lastAccessed) {
						otherLists[listId].lastAccessed = tabs[i].lastAccessed;
						otherLists[listId].latestTabId = tabs[i].id;
					}
				}
			}
			// タブをソート
			tabList.sort(orderFunc);
			// HTML生成
			lists[targetListId].tabs = tabList;
			var elements = [createListElement(lists[targetListId])];
			for (var listId in lists) {
				if (otherLists[listId]) otherLists[listId].title = lists[listId].title;
			}
			//if (bg.config.otherLists) elements.push(createOtherListsElement(otherLists));
			elements.push(createOtherListsElement(otherLists));
			return elements;
		}).then(function(obj) {
			// 画面表示
			var isError = typeof obj == 'string';
			$('#sidebar')
				.empty().toggle(!isError).append(isError ? '' : obj)
				.toggleClass('hide_other_lists', !bg.config.otherLists).setFontSize();
			$('#sidebar_msg')
				.toggle(isError).html(isError ? obj : '');
			Dialog.close();
		});
	};
	
	// ウィンドウIDを取得して起動
	browser.windows.getCurrent().then(function(window) {
		currentWindowId = window.id;
		
		// メインページの場合
		if (!isSidebar) {
			generateMainBoard();
			bg.start.processing = false;
			return;
		}
		
		// サイドバーの場合
		generateSidebar();
		
		// タブが作られたとき（backgroundでの処理の完了後に発動）
		browser.runtime.onMessage.addListener(function(obj) {
			if (obj.name != 'created') return;
			var tab = obj.param;
			if (tab.windowId != currentWindowId || bg.start.processing) return;
			createTabElement(tab).insertAfter(tab.openerTabId ? '.current_tab' : '.tablist:last');
			updateTabInfo().then(generateSidebar);
		});
		
		// タブが切り替わったとき（backgroundでの処理の完了後に発動）
		browser.runtime.onMessage.addListener(function(obj) {
			if (obj.name != 'activated') return;
			obj = obj.param;
			if (obj.windowId != currentWindowId) return;
//			generateSidebar().then(updateTabInfo);
			updateTabInfo().then(generateSidebar);
		});
		
		// タブが更新されたとき
		browser.tabs.onUpdated.addListener(function(tabId, obj, tab) {
			if (!obj.url && !obj.title || tab.windowId != currentWindowId) return;
			bg.delay().then(generateSidebar);
		});
		
		// タブが閉じられたとき
		browser.tabs.onRemoved.addListener(function(tabId, obj) {
			if (obj.windowId != currentWindowId) return;
			bg.delay().then(generateSidebar);
		});
		
		// タブが切り離されたとき
		browser.tabs.onDetached.addListener(function(tabId, obj) {
			if (obj.oldWindowId != currentWindowId) return;
			$('.current_tab').remove();
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
		Dialog.confirm(i18nTexts.CONFIG_RESET_CONFIRM).then(function() {
			bg.removeTabListInfo(currentWindowId).then(function() {
				return Dialog.alert(i18nTexts.CONFIG_RESET_DONE);
			}).then(function() {
				bg.switchTab(currentWindowId, bg.mainPageTabIds[currentWindowId]);
			});
		}, $.noop);
	});
	
	// リスト追加ボタン
	$('#add_list').on('click', function() {
		var $columns = $('.column_block');
		$('#main').append(
			createColumnElement({
				colId: $columns.length,
				lists: [{ listId: Date.now(), title: i18nTexts.NEW_LIST_NAME, tabs: [] }]
			})
		);
		updateListInfo();
	});
	
	// リスト削除ボタン
	$(document).on('click', '.remove_list_text', function() {
		var $tablistBlock = $(this).parent().parent();
		var listTitle = $tablistBlock.find('.tablist_title').text();
		Dialog.confirm(i18nTexts.REMOVE_LIST_CONFIRM.replace('%s', escapeHtml(listTitle)), !bg.config.removeList).then(function() {
			$tablistBlock.find('.tabitem').each(function() {
				bg.switchTab(currentWindowId, +$(this).attr('data-tab-id'));
			});
			$tablistBlock.remove();
			updateListInfo();
		}, $.noop);
	});
	
	// タブ追加ボタン
	$(document).on('click', '.add_tab_text', function() {
		var $tablist = $(this).parent().parent().find('.tablist');
		browser.tabs.create({ active: false }).then(function(tab) {
			if (!isSidebar) {
				tab.isNewTab = true;
				$tablist.append(createTabElement(tab));
				updateTabInfo();
			} // サイドバーの場合はonCreatedがハンドリング
		});
	});
	
	// タブ削除ボタン
	$(document).on('click', '.close_tab_btn', function(e) {
		var $tabitem = $(this).parent();
		var tabTitle = $tabitem.find('.tabitem_text').text();
		Dialog.confirm(i18nTexts.CLOSE_TAB_CONFIRM.replace('%s', escapeHtml(tabTitle)), !bg.config.closeTab).then(function() {
			if (isSidebar && $tabitem.hasClass('current_tab')) {
				// 表示中のタブを閉じた場合は、同じリストの1つ前のタブへ切り替え
				bg.switchTab(currentWindowId, +$tabitem.attr('data-tab-id'), +$tabitem.prev().attr('data-tab-id'));
			} else {
				bg.switchTab(currentWindowId, +$tabitem.attr('data-tab-id'));
			}
			$tabitem.remove();
			updateTabInfo();
		}, $.noop);
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
	
	// サイドバーでの他のリスト一覧切り替え
	$(document).on('click', '.hide_other_lists .tablist_title', function() {
		$(this).parent().parent().children().toggle();
	});
	
	// 右クリック抑止
	$(document).on('contextmenu', function(e) {
		e.preventDefault();
	});
	
	// ハイパーリンクの動作
	$(document).on('click', 'a', function(e) {
		bg.openPageFromBoard(currentWindowId, $(this).attr('href'));
		e.preventDefault();
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
			middleClick: $('#conf_middleclick'),
			tabbarOrder: $('#conf_tabbarorder'),
			removeTabs : $('#conf_removetabs')
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
