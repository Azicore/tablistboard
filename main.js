
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
	
	// ドキュメントオブジェクト
	var $document = $(document);
	
	
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
		var procs = [];
		$('.tabitem').each(function() {
			procs.push(browser.tabs.get(+$(this).attr('data-tab-id')));
		});
		return Promise.all(procs).then(function(tabs) {
			var tabIds = [], index;
			for (var i = 0; tabs.length > i; i++) {
				if (tabs[i].pinned || tabs[i].windowId != currentWindowId) continue;
				tabIds.push(tabs[i].id);
				if (index == null) index = tabs[i].index;
			}
			return tabIds.length > 0 ? browser.tabs.move(tabIds, { windowId: currentWindowId, index: index }) : Promise.resolve();
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
		return $('<div>').addClass('column_block').append($column);//.attr('data-col-id', col.colId);
	};
	
	// リストのHTMLを生成する
	var createListElement = function(list) {
		// 依存変数：updateTabInfo, i18nTexts
		// list = {
		//     listId: <Number>, // リストID
		//     title : <String>, // リスト名
		//     tabs  : <Array>,  // tabの配列
		//     offset: <Number>, // タブの数（tabsが無い場合）
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
		return $('<li>').addClass('tablist_block')
			.attr('data-list-id', list.listId).attr('data-order-offset', list.offset || 0)
			.append(genTextLine('tablist_title', 'tablist_title_text', list.title))
//			.append(genTextLine('tablist_title', 'tablist_title_text', list.title + (isSidebar ? ' (' + list.tabs.length + ')' : '')))
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
		return $('<li>').addClass(cls.join(' ')).attr('data-tab-id', tab.id)
			.attr('data-url', tab.url).attr('title', tab.title + '\n' + tab.url)
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
			var title = otherListsArr[i].title + ' (' + otherListsArr[i].num + ')';
			$otherLists.append($('<li>').addClass(cls).text(title).attr('title', title).attr('data-tab-id', otherListsArr[i].latestTabId));
		}
		return $('<div>').attr('id', 'otherlist_block').append($('<p>').addClass('tablist_title').html(i18nTexts.SIDEBAR_OTHER_LISTS)).append($otherLists);
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
					$document.off('keydown', esc);
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
				$document.on('keydown', esc);
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
	
	// 右クリックメニュー
	var Menu = function(selector, menuId) {
		// selector: 右クリックによってこのメニューを表示するセレクタ
		// menuId  : メニューのID
		var self = this;
		// メニューのDOMの生成
		var createMenuCont = function(menuItems, id) {
			var $menuCont = $('<div>').addClass('menu_cont').attr('id', id);
			var $menuItemGroup = $('<ul>').addClass('menu_noline');
			for (var i = 0; menuItems.length > i; i++) {
				var item = menuItems[i];
				if (!item.name) {
					$menuCont.append($menuItemGroup);
					$menuItemGroup = $('<ul>');
				} else {
					var $item = $('<li>').text(item.name);
					if (item.className && !item.disabled) $item.addClass(item.className);
					if (item.param != null) $item.attr('data-menu-param', item.param);
					if (item.menuItems) $item.addClass('has_submenu').append(createMenuCont(item.menuItems, item.submenuId));
					if (item.disabled) $item.addClass('menu_disabled');
					$menuItemGroup.append($item);
				}
			}
			$menuCont.append($menuItemGroup);
			return $menuCont;
		};
		// メニューの表示位置の決定
		var setMenuPosition = function($menuCont, ex, ey) {
			var $window = $(window), winw = $window.width(), winh = $window.height();
			var cw = $menuCont.outerWidth(), ch = $menuCont.outerHeight();
			var wx = -$window.scrollLeft(), wy = -$window.scrollTop(), pw = 0, ph = 0;
			if (ex != null) { // 1階層目
				wx += ex; wy += ey;
			} else { // 2階層目以降
				var $parent = $menuCont.parent(), p = $parent.offset();
				wx += p.left; wy += p.top; pw = $parent.outerWidth(); ph = $parent.outerHeight();
			}
			$menuCont.css({
				left: (winw >= wx + pw + cw ? wx + pw : Math.max(wx - cw, 0)) + 'px',
				top : (winh >= wy + ch ? wy : Math.max(wy + ph - ch, 0)) + 'px'
			});
		};
		// 右クリックでメニューを表示
		$document.on('contextmenu', selector, function(e) {
			var $this = $(this);
			self.$this = $this;
			self.beforeMenu && self.beforeMenu($this);
			e.preventDefault();
			var $menuCont = createMenuCont(self.menuItems, menuId);
			$menuCont.on('mouseenter', 'li', function() {
				var $this = $(this);
				clearTimeout($this.data('timer'));
				if ($this.hasClass('menu_disabled')) return;
				$this.addClass('menu_mouse_over').parent();
				if ($this.hasClass('has_submenu')) {
					$this.data('timer', setTimeout(function() {
						var $subMenuCont = $this.children('div');
						setMenuPosition($subMenuCont);
						$subMenuCont.show();
						// 謎の重なり描画エラー（z-indexが効かない）の対策。強制的にスクロールを発生させる。
						$('body').css('height', '3000px'); $document.scrollTop($document.scrollTop() + 1).scrollTop($document.scrollTop() - 1); $('body').css('height', '');
					}, 200));
				}
			}).on('mouseleave', 'li', function() {
				var $this = $(this);
				$this.removeClass('menu_mouse_over');
				clearTimeout($this.data('timer'));
				$this.data('timer', setTimeout(function() {
					$this.children('div').hide();
				}, 200));
			});
			$('body').append($menuCont);
			$menuCont.find('div').hide();
			setMenuPosition($menuCont, e.pageX, e.pageY);
		});
		// 左クリックでメニューを閉じる（項目選択イベントの後でなければならないため、clickを使用）
		$document.on('click', function(e) {
			if (e.which == 1) self.close();
		});
		// 右クリックでメニューを閉じる（別のメニューを開く前でなければならないため、mousedownを使用）
		$document.on('mousedown', function(e) {
			if (e.which == 3) self.close();
		});
		// メニューを閉じる
		this.close = function() {
			$('.menu_cont').remove();
		};
	};
	
	
	// --------------------------------------------------------------------------------
	// # メイン処理
	
	// タブ一覧の生成
	var prepareTabLists = function(o) {
		var {tabs, tabInfo, tabStatus, lists,
			mainPageTabId,             // メインページ・サイドバー共に使用
			lastTabId,                 // メインページ生成で使用
			currentTabId, targetListId // サイドバー生成で使用
		} = o;
		var isSidebar = lastTabId == null;
		var orderFunc = function(a, b) { return a.order > b.order ? 1 : -1; };
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
		var otherLists = {}; // サイドバーでのみ使用
		var defaultOrder = 1e10;
		var defaultListId = cols[0].lists[0].listId;
		var limitTime = Date.now() - bg.config.oldTabTerm * 36e5;
		var procs = [];
		for (var i = 0; tabs.length > i; i++) {
			if (tabs[i].id == mainPageTabId) continue;
			var listId = tabInfo[i] && tabInfo[i].listId;
			// サイドバーで対象以外のリストの場合は、タブの数を集計
			if (isSidebar && listId != targetListId) {
				if (!otherLists[listId]) otherLists[listId] = { lastAccessed: 0, num: 0 };
				otherLists[listId].num++;
				if (tabs[i].lastAccessed > otherLists[listId].lastAccessed) {
					otherLists[listId].lastAccessed = tabs[i].lastAccessed;
					otherLists[listId].latestTabId = tabs[i].id;
				}
				continue;
			}
			if (!isSidebar && !lists[listId]) listId = defaultListId;
			var order = tabInfo[i] && tabInfo[i].order || defaultOrder;
			tabs[i].listId    = listId;
			tabs[i].order     = order;
			tabs[i].isOldTab  = limitTime > tabs[i].lastAccessed;
			tabs[i].isNewTab  = !tabStatus[i].activated || !tabStatus[i].displayed;
			tabs[i].isLastTab = !isSidebar && tabs[i].id == lastTabId;
			tabs[i].isCurrTab = isSidebar && tabs[i].id == currentTabId;
			if (!tabLists[listId]) tabLists[listId] = [];
			tabLists[listId].push(tabs[i]);
			procs.push(bg.setTabStatus(tabs[i].id, 'displayed', true));
		}
		// ※注意：この時点で空のリストはtabLists、otherListsには入ってない。
		// リストごとにタブをソート
		for (var i in tabLists) {
			tabLists[i].sort(orderFunc);
		}
		// HTML生成
		var $elements = [];
		for (var i = 0; cols.length > i; i++) {
			for (var j = 0; cols[i].lists.length > j; j++) {
				var listId = cols[i].lists[j].listId;
				if (isSidebar && listId != targetListId) {
					cols[i].lists[j].tabs = [];
					cols[i].lists[j].offset = otherLists[listId] ? otherLists[listId].num : 0;
				} else {
					cols[i].lists[j].tabs = tabLists[listId] || [];
				}
			}
			$elements.push(createColumnElement(cols[i]));
		}
		return [procs, $elements, otherLists];
	};
	
	// メインページのタブ一覧生成
	var generateMainBoard = function() {
		return bg.getTabListInfo(currentWindowId).then(function(o) {
			o.lastTabId     = bg.lastTabIds[currentWindowId];
			o.mainPageTabId = bg.mainPageTabIds[currentWindowId];
			// ウィンドウに情報がない場合は新規リストを1つ作成
			if (!o.lists) {
				o.lists = {};
				var newList = { listId: Date.now(), column: 0, order: 1, title: i18nTexts.NEW_LIST_NAME };
				o.lists[newList.listId] = newList;
			}
			var [procs, $elements] = prepareTabLists(o);
			var $main = $('#main').setFontSize();
			for (var i = 0; $elements.length > i; i++) {
				$main.append($elements[i]);
			}
			return Promise.all([updateTabInfo(), updateListInfo(), Promise.all(procs)]);
		});
	};
	
	// サイドバーでのタブ一覧生成
	var generateSidebar = function() {
		return bg.getTabListInfo(currentWindowId).then(function(o) {
			var {tabs, tabInfo, tabStatus, lists, currentTabId} = o;
			o.mainPageTabId = bg.mainPageTabIds[currentWindowId];
			// メインページを表示中の場合
			if (currentTabId != null && currentTabId == o.mainPageTabId) {
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
					targetListId = o.targetListId = tabInfo[i] && tabInfo[i].listId;
					break;
				}
			}
			if (!lists[targetListId]) {
				return i18nTexts.SIDEBAR_ERROR_NOINFO;
			}
			var [procs, $elements, otherLists] = prepareTabLists(o);
			for (var listId in lists) {
				if (otherLists[listId]) otherLists[listId].title = lists[listId].title;
			}
			$elements.push(createOtherListsElement(otherLists));
			return [procs, $elements];
		}).then(function(obj) {
			// 画面表示
			var $sidebar = $('#sidebar').empty();
			var $sidebarMsg = $('#sidebar_msg');
			Dialog.close();
			tabMenu.close();
			listMenu.close();
			if (typeof obj != 'string') {
				$sidebar.show().append(obj[1]).toggleClass('hide_other_lists', !bg.config.otherLists).setFontSize();
				$sidebar.find('.tablist_block').each(function() {
					var $this = $(this);
					if ($this.find('.tablist').children().length == 0) $this.hide();
				});
				$sidebarMsg.hide();
				return Promise.all(obj[0]);
			} else {
				$sidebar.hide();
				$sidebarMsg.show().html(obj);
				return Promise.resolve();
			}
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
			createTabElement(tab).insertAfter(tab.openerTabId ? '.current_tab' : '.tabitem:last');
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
	bg.config.onReady(function() {
		bg.config.theme != 'default' && $('head').append($('<link>').attr({
			rel : 'stylesheet',
			href: 'css/theme_' + bg.config.theme + '.css'
		}));
	});
	
	// メニューの準備
	var tabMenu, listMenu;
	(function() {
		// リスト一覧の動的生成
		var createTabListMenu = function($targetTablistBlock, className) {
			var tabListMenuItems = [];
			var targetListId = $targetTablistBlock.attr('data-list-id');
			$('.tablist_block').each(function() {
				var $this = $(this);
				var listId = $this.attr('data-list-id');
				var num = +$this.attr('data-order-offset') || $this.find('.tabitem').length;
				if (listId == targetListId) return true;
				tabListMenuItems.push({
					name     : $this.find('.tablist_title').text() + ' (' + num + ')',
					className: className,
					param    : listId
				});
			});
			tabListMenuItems.sort(function(a, b) { return a.name > b.name ? 1 : -1; });
			if (tabListMenuItems.length == 0) tabListMenuItems.push({ name: i18nTexts.MENU_NO_LIST, disabled: true });
			return tabListMenuItems;
		};
		// タブのメニューを生成
		tabMenu = new Menu('.tabitem', 'tab_menu');
		tabMenu.menuItems = [
			{name: i18nTexts.MENU_MOVE_TO_LIST, menuItems: [], submenuId: 'menu_move_to_list'},
			{},
			{name: i18nTexts.MENU_SEPARATE_TAB,    className: 'menu_separate_tab', param: 0},
			{name: i18nTexts.MENU_SEPARATE_ABOVE,  className: 'menu_separate_tab', param: 1},
			{name: i18nTexts.MENU_SEPARATE_BELOW,  className: 'menu_separate_tab', param: 2},
			{name: i18nTexts.MENU_SEPARATE_DOMAIN, className: 'menu_separate_tab', param: 3},
			{},
			{name: i18nTexts.MENU_MOVE_TOP,    className: 'menu_move_position', param: 0},
			{name: i18nTexts.MENU_MOVE_BOTTOM, className: 'menu_move_position', param: 1},
			{},
			{name: i18nTexts.MENU_COPY_TEXT, menuItems: [
				{name: i18nTexts.MENU_COPY_URL,   className: 'menu_copy_text', param: 0},
				{name: i18nTexts.MENU_COPY_TITLE, className: 'menu_copy_text', param: 1},
				{name: i18nTexts.MENU_COPY_BOTH,  className: 'menu_copy_text', param: 2}
			]},
			{},
			{name: i18nTexts.MENU_CANCEL}
		];
		tabMenu.beforeMenu = function() {
			tabMenu.menuItems[0].menuItems = createTabListMenu(tabMenu.$this.parent().parent(), 'menu_move_to_list');
		};
		// リストのメニューを生成
		listMenu = new Menu('#main .tablist_title', 'list_menu');
		listMenu.menuItems = [
			{name: i18nTexts.MENU_INSERT_LEFT,  className: 'menu_insert_column', param: 0},
			{name: i18nTexts.MENU_INSERT_RIGHT, className: 'menu_insert_column', param: 1},
			{},
			{name: i18nTexts.MENU_REPLACE_LEFT,  className: 'menu_swap_column', param: 0},
			{name: i18nTexts.MENU_REPLACE_RIGHT, className: 'menu_swap_column', param: 1},
			{},
			{name: i18nTexts.MENU_MERGE_LIST, menuItems: [], submenuId: 'menu_merge_list'},
			{},
//			{name: i18nTexts.MENU_SORT_TITLE,  className: 'menu_sort_tab', param: 0},
//			{name: i18nTexts.MENU_SORT_ACCESS, className: 'menu_sort_tab', param: 1},
//			{},
			{name: i18nTexts.MENU_CANCEL}
		];
		listMenu.beforeMenu = function($this) {
			var $tablistBlock = $this.parent();
			var $column       = $tablistBlock.parent();
			var $columnBlock  = $column.parent();
			listMenu.menuItems[6].menuItems = createTabListMenu($tablistBlock, 'menu_merge_list');
			listMenu.menuItems[0].disabled = listMenu.menuItems[1].disabled = $column.children().length == 1;
			listMenu.menuItems[3].disabled = $columnBlock.prev().length == 0;
			listMenu.menuItems[4].disabled = $columnBlock.next().length == 0;
		};
	})();
	
	
	
	// --------------------------------------------------------------------------------
	// # 各種イベント
	
	// リセットボタン
	$('.conf_reset').on('click', function(e) {
		var mode = +$(this).attr('data-reset');
		Promise.resolve().then(function() {
			if (mode == 1) {
				// タブリスト情報を消去
				return Dialog.confirm(i18nTexts.CONFIG_RESET_CONFIRM1).then(function() {
					return bg.removeTabListInfo(currentWindowId);
				});
			} else if (mode == 2) {
				// 設定をリセット
				return Dialog.confirm(i18nTexts.CONFIG_RESET_CONFIRM2).then(function() {
					return browser.storage.local.remove(['config', 'update']);
				}).then(function() {
					return bg.config.reload();
				}).then(function() {
					return bg.reloadSidebar();
				});
			} else if (mode == 3) {
				// 未読状態をリセット
				return Dialog.confirm(i18nTexts.CONFIG_RESET_CONFIRM3).then(function() {
					return bg.removeTabListInfo(currentWindowId, true);
				});
			}
		}).then(function() {
			return Dialog.alert(i18nTexts.CONFIG_RESET_DONE);
		}).then(function() {
			bg.switchTab(currentWindowId, bg.mainPageTabIds[currentWindowId]);
		}).catch($.noop);
	});
	
	// リスト追加ボタン
	$('#add_list').on('click', function() {
		var $columns = $('.column_block');
		var $newColumnBlock = createColumnElement({
			colId: $columns.length,
			lists: [{ listId: Date.now(), title: i18nTexts.NEW_LIST_NAME, tabs: [] }]
		});
		$('#main').append($newColumnBlock);
		$newColumnBlock.find('.tablist_title_text').click();
		updateListInfo();
	});
	
	// リスト削除ボタン
	$document.on('click', '.remove_list_text', function() {
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
	$document.on('click', '.add_tab_text', function() {
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
	$document.on('click', '.close_tab_btn', function(e) {
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
	$document.on('click', '.tabitem, .listitem', function(e) {
		bg.switchTab(currentWindowId, bg.mainPageTabIds[currentWindowId], +$(this).attr('data-tab-id'));
	}).on('mousedown', '.tabitem, .listitem', function(e) {
		if (bg.config.middleClick && e.which == 2) { // 中クリックでタブ削除
			$(this).find('.close_tab_btn').trigger('click');
			e.preventDefault();
		}
	});
	
	// リスト名変更
	$document.on('click', '.tablist_title_text', function() {
		if (isSidebar) return;
		var $title = $(this).parent();
		var title = $title.text();
		var $input = $('<input type="text">').val(title);
		var changeTitle = function() {
			var newTitle = $input.val();
			$title.empty().append($('<span>').addClass('tablist_title_text').text(newTitle !== '' ? newTitle : title));
			$input.remove();
			updateListInfo();
		};
		$title.empty().append($input);
		$input.on('blur', changeTitle).on('keypress', function(e) {
			if (e.which == 13) changeTitle();
		}).focus().select();
	});
	
	// サイドバーでの他のリスト一覧切り替え
	$document.on('click', '.hide_other_lists .tablist_title', function() {
		$('#otherlist_block').toggle();
		$('.current_tab').parent().parent().toggle();
	});
	
	// 右クリック抑止
	$document.on('contextmenu', function(e) {
		e.preventDefault();
	});
	
	// ハイパーリンクの動作
	$document.on('click', 'a', function(e) {
		bg.openPageFromBoard(currentWindowId, $(this).attr('href'));
		e.preventDefault();
	});
	
	
	// メニュー：他のリストへ移動
	$document.on('click', '.menu_move_to_list', function() {
		var targetListId = $(this).attr('data-menu-param');
		$('.tablist_block').each(function() {
			var $this = $(this);
			if ($this.attr('data-list-id') == targetListId) {
				$this.find('.tablist').append(tabMenu.$this);
				updateTabInfo().then(function() {
					if (isSidebar) generateSidebar();
				});
				return false;
			}
		});
	});
	
	// メニュー：新しいリストへタブを分離
	$document.on('click', '.menu_separate_tab', function() {
		var action = +$(this).attr('data-menu-param');
		var $tablistBlock = tabMenu.$this.parent().parent();
		var $newTablistBlock = createListElement({ listId: Date.now(), title: i18nTexts.NEW_LIST_NAME, tabs: [] });
		$tablistBlock.after($newTablistBlock);
		var $newTablist = $newTablistBlock.find('.tablist');
		if (action == 0) {
			$newTablist.append(tabMenu.$this);
		} else if (action == 1) {
			$newTablist.append(Array.prototype.reverse.call(tabMenu.$this.prevAll())).append(tabMenu.$this);
		} else if (action == 2) {
			$newTablist.append(tabMenu.$this.nextAll()).prepend(tabMenu.$this);
		} else if (action == 3) {
			var targetDomain = tabMenu.$this.attr('data-url').match(/^https?:\/\/([^\/]+)/);
			if (targetDomain) {
				tabMenu.$this.parent().children().each(function() {
					var $this = $(this);
					var domain = $this.attr('data-url').split(/\/+/);
					if (domain[1] == targetDomain[1]) $newTablist.append($this);
				});
			} else {
				$newTablist.append(tabMenu.$this);
			}
		}
		$newTablistBlock.find('.tablist_title_text').click();
		Promise.all([updateListInfo(), updateTabInfo()]).then(function() {
			if (isSidebar) generateSidebar();
		});
	});
	
	// メニュー：テキストコピー
	$document.on('click', '.menu_copy_text', function() {
		var target = +$(this).attr('data-menu-param');
		var $input = $('<textarea>').val(
			target == 0 ? tabMenu.$this.attr('data-url') :
			target == 1 ? tabMenu.$this.text() : tabMenu.$this.attr('title')
		);
		$('body').append($input);
		$input.select();
		document.execCommand('copy');
		$input.remove();
	});
	
	// メニュー：タブを移動
	$document.on('click', '.menu_move_position', function() {
		tabMenu.$this.parent()[+$(this).attr('data-menu-param') ? 'append' : 'prepend'](tabMenu.$this);
		updateTabInfo();
	});
	
	// メニュー：列の間に挿入
	$document.on('click', '.menu_insert_column', function() {
		var $tablistBlock = listMenu.$this.parent();
		var $columnBlock = createColumnElement({lists: []});
		$tablistBlock.parent().parent()[+$(this).attr('data-menu-param') ? 'after' : 'before']($columnBlock);
		$columnBlock.find('.column').append($tablistBlock);
		updateListInfo();
	});
	
	// メニュー：列を入れ替え
	$document.on('click', '.menu_swap_column', function() {
		var $columnBlock = listMenu.$this.parent().parent().parent();
		var dir = +$(this).attr('data-menu-param');
		var $next = $columnBlock[dir ? 'next' : 'prev']();
		if ($next.length) $next[dir ? 'after' : 'before']($columnBlock);
		updateListInfo();
	});
	
	// メニュー：リストに統合
	$document.on('click', '.menu_merge_list', function() {
		var targetListId = $(this).attr('data-menu-param');
		$('.tablist_block').each(function() {
			var $this = $(this);
			if ($this.attr('data-list-id') == targetListId) {
				$this.find('.tablist').append(listMenu.$this.parent().find('.tabitem'));
				listMenu.$this.parent().remove();
				Promise.all([updateListInfo(), updateTabInfo()]);
				return false;
			}
		});
	});
	
	// メニュー：ソート
//	$document.on('click', '.menu_sort', function() {
//	
//	});
	
	
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
				bg.reloadSidebar();
			});
		});
		// 初期化
		bg.config.onReady(loadConf);
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
