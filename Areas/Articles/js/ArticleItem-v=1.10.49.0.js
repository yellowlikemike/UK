(function () {
    "use strict";
    var wo$ = window.wo$;

    wo$(function () {

        var page = wo$('#article');
        if (!page.length) return;

        var controller = {

            init: function () {
                var productArea = page.data('product-area');
                var id = page.data('id');
                
                controller.bindGalleria();

                WhistleOut.getAds(productArea);
                page.find('[data-comments-link]').off('click').click(function (e) {
                    e.preventDefault();
                    WhistleOut.scrollTo('#comments-wrapper');
                });

                page.find('[data-sticky_column]').stick_in_parent({
                    inner_scrolling: false,
                    parent: page.find('[data-sticky_parent]'),
                    offset_top: 70,

                    // HACK: Refresh explicitly every several ticks to solve problem with incorrect height calculation for the visible parent
                    // Smaller value might introduce unnecessary performance overhead as it will call the recalculation more frequently
                    recalc_every: 50
                });

                var ads = page.find('[data-ads]');
                if (ads.length > 0) {
                    wo$.ajax({
                        url: '/Ajax/Shared/Ad/ArticleAds?productArea=' + productArea + '&articleId=' + id,
                        type: 'GET',
                        success: function (result) {
                            var $result = wo$(result);
                            WhistleOut.applyPromoAds($result);
                            ads.append($result);
                        }
                    });
                }

                controller.registerNotifications();
            },

            registerNotifications: function () {
                WhistleOut.notifications.add(function (notification, data) {
                    if (notification === 'AdsLoaded') {
                        var bottom = page.find('[data-adplacement="ArticleBottom"]');
                        var sidebar = page.find('[data-adplacement="ArticleSideBar"]');
                        if (bottom.is(':visible') && sidebar.is(':visible')) {
                            bottom.addClass('hidden-xs');
                        }
                    }
                });
            },

            bindGalleria: function () {
                if (wo$('.galleria').length) {
                    Galleria.configure({
                        debug: false,
                        autoplay: 5000,
                        height: 0.8,
                        lightbox: true,
                        imageCrop: true,
                        transition: 'slide',
                        showInfo: false
                    });
                    Galleria.loadTheme('/js/jquery/galleria/themes/classic/galleria.classic.min.js');                    
                    Galleria.run('.galleria');
                }

            }
        };

        controller.init();
    });

})();