(function () {
    'use strict';

    WhistleOut.Core = {};

    WhistleOut.Core.showSiteNotice = function () {
        try {
            if (wo$('#siteNotice') && wo$('#siteNotice').length > 0) {
                var key = wo$('#siteNotice').data('cookie-key');
                if (wo$.cookie(key) == undefined) {
                    wo$('#siteNotice').slideToggle(300);
                    wo$.cookie(key, '', { path: '/' });
                    wo$('#siteNoticeClose').click(function () {
                        wo$('#siteNotice').slideToggle(300);
                        wo$.cookie(key, '', { path: '/', expires: 7 });
                    });
                }
            }
        } catch (e) { }
    }

    WhistleOut.Core.bindExpressNotice = function () {
        wo$('#expressDisable').click(function () {
            var config = WhistleOut.getSiteConfiguration();
            wo$.removeCookie(config.cookieName,
            {
                path: '/',
                domain: config.cookieDomain
            });
            if (location.href.indexOf('adi=') === -1) {
                location.reload();
            } else {
                var url = WhistleOut.updateQueryStringParameter(location.href, 'adi', null);
                location.href = url;
            }
        });
    }

    WhistleOut.Core.bindTopNav = function () {
        wo$('#site-search-button').on('click', function () {
            wo$(this).hide();
            wo$('#site-search-form').show();
            if (wo$('#site-search-form').is(':visible')) {
                wo$('#site-search-query').focus();
            }
        });

        wo$('#site-search-icon').on('click', function () {
            wo$('#site-search-form').hide();
            wo$('#site-search-button').show();
        });

        wo$('#site-search-query, #site-search-query-2').on('keydown', function (event) {
            if (event.which === 13) {
                WhistleOut.Core.search(wo$(this).val());
                return false;
            }
        });

        wo$('#search-term').on('keydown', function (event) {
            if (event.which === 13 && wo$(this).val() && wo$(this).val().length) {
                WhistleOut.Core.search(wo$(this).val());
                return false;
            }
        });

        wo$('#search-term-button').on('click', function () {
            if (wo$('#search-term').val() && wo$('#search-term').val().length) {
                WhistleOut.Core.search(wo$('#search-term').val());
            }
            return false;
        });

        wo$('#site-search-button-2').on('click', function () {
            var query = wo$('#site-search-query-2').val();
            WhistleOut.Core.search(query);
        });

        var originalLeave = wo$.fn.popover.Constructor.prototype.leave;
        wo$.fn.popover.Constructor.prototype.leave = function (obj) {
            var self = obj instanceof this.constructor
                ? obj
                : wo$(obj.currentTarget)[this.type](this.getDelegateOptions()).data('bs.' + this.type);
            var container, timeout;

            originalLeave.call(this, obj);

            if (obj.currentTarget) {
                container = wo$(obj.currentTarget).siblings('.popover');
                timeout = self.timeout;
                container.one('mouseenter', function () {
                    clearTimeout(timeout);
                    container.one('mouseleave', function () {
                        wo$.fn.popover.Constructor.prototype.leave.call(self, self);
                    });
                });
            }
        };

        var nav = wo$('#navbar');
        nav.find('a.dropdown-toggle').on('click', function () {
            var $this = wo$(this);
            if (!nav.hasClass('in') && $this.siblings('ul.dropdown-menu').is(':visible')) {
                var href = $this.attr('href');
                location.href = href;
            }
        });
    }

    WhistleOut.Core.search = function (query) {
        var url = wo$('#site-search').data('url');
        window.location = url + '?q=' + query;
    }

    WhistleOut.Core.checkCountry = function () {
        try {
            if ((wo$.cookie('woCountrySelector') == null || typeof (wo$.cookie('woCountrySelector')) === 'undefined') && document.referrer.indexOf('.whistleout.') === -1) {
                wo$.cookie('woCountrySelector', '', { path: '/' });
                var config = WhistleOut.getSiteConfiguration();
                if (config.enableGeoCheck) {
                    wo$.ajax({
                        url: 'https://www.whistleout.com.au/cdn-cgi/trace',
                        type: 'GET',
                        success: function (result) {
                            var matches = result.match('loc=(.{2})');
                            if (matches && matches.length === 2) {
                                var country = 0;
                                switch (matches[1]) {
                                    case 'AU':
                                        country = 1;
                                        break;
                                    case 'US':
                                        country = 3;
                                        break;
                                    case 'CA':
                                        country = 5;
                                        break;
                                    case 'MX':
                                        country = 8;
                                        break;
                                }
                                if (country > 0 && country !== config.country) {
                                    WhistleOut.Core.showCountrySwitcher(country);
                                }
                            }
                        }
                    });
                }
            }
        } catch (e) { }
    }

    WhistleOut.Core.showCountrySwitcher = function (country) {
        try {
            var data = {
                country: country
            };
            wo$.ajax({
                url: '/Layout/CountrySwitcher',
                data: data,
                type: 'GET',
                success: function (result) {
                    if (result !== '') {
                        wo$('#country-switcher-container').html(result);
                        wo$('#country-switcher-modal').modal('show');
                    }
                }
            });
        } catch (e) { }
    }

    WhistleOut.Core.bindLinkStrip = function () {
        var strip = wo$('#suggested-articles');
        strip.affix({
            offset: { top: 400 }
        });

        wo$('#suggested-articles-close').on('click', function () {
            var expires = new Date();
            expires.setTime(expires.getTime() + (60 * 60 * 1000));
            wo$.cookie('ShowStickyBottomStrip', '0', { path: '/', expires: expires });
            strip.hide();
        });
    }

    WhistleOut.Core.bindAdminLinks = function () {
        var timeout;
        wo$('#admin-links').hover(function () {
            clearTimeout(timeout);
            wo$(this).animate({
                height: wo$(this).get(0).scrollHeight,
                opacity: 1
            },
                250);
        },
            function () {
                var $this = wo$(this);
                timeout = setTimeout(function () {
                    $this.animate({
                        height: '30px',
                        opacity: 0.7
                    },
                        250);
                }, 1000);
            });

        wo$('#admin-purge-cache').click(function () {
            if (confirm('Are you sure you want to purge this page from the cache?')) {
                var data = {
                    url: location.href
                };
                wo$.ajax({
                    url: '/Internal/Shared/Infrastructure/PurgeCacheUrl',
                    type: 'POST',
                    data: data,
                    success: function () {
                        alert('Success!');
                    },
                    error: function () {
                        alert('An error has occurred purging this URL from the cache');
                    }
                });
            }
        });
    }

})();

wo$(function () {
    if (WhistleOut.Core) {
        WhistleOut.Core.showSiteNotice();
        WhistleOut.Core.bindExpressNotice();
        WhistleOut.Core.bindAdminLinks();
        WhistleOut.Core.bindTopNav();
        WhistleOut.Core.checkCountry();
        WhistleOut.Core.bindLinkStrip();
    }
});

