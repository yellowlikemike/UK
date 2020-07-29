(function () {
    "use strict";
    var wo$ = window.wo$;
    var WhistleOut = window.WhistleOut;

    wo$(function () {

        var controller = {
            init: function () {
                controller.bind();
            },

            bind: function () {

                var widgets = wo$('[data-widget-type="mobile-phone-search-form"]');
                if (!widgets.length) return;

                var doSearch = function (url) {
                    var win = window.open(url, '_blank');
                    win.focus();
                };

                widgets.off('click');

                widgets.on('click', '[data-search-button]', function () {
                    WhistleOut.trackEvent('MobilePhoneSearchForm', 'Search');

                    var widget = wo$(this).parents('[data-widget-type="mobile-phone-search-form"]');
                    var searchUrl = wo$(this).data('searchurl');
                    var detectLocation = wo$(this).data('detectlocation');
                    var initialQueryParams = wo$(this).data('query');

                    var phoneSelectElement = widget.find('#phone-select');
                    var selectedPhoneOption = phoneSelectElement.find("option:selected");
                    var selectedPhoneShortUrl = selectedPhoneOption.data('shorturl');
                    var simType = selectedPhoneOption.data('simtype');

                    var data = widget.find('#data-select').val();

                    var queryString = '';

                    if (initialQueryParams) {
                        queryString = decodeURIComponent(initialQueryParams);
                        if (queryString.indexOf('?') === -1)
                            queryString = '?' + queryString;
                    }

                    if (selectedPhoneShortUrl) {
                        queryString = WhistleOut.updateQueryStringParameter(queryString, 'phone', selectedPhoneShortUrl);
                    } else if (selectedPhoneOption.val() === '-1') {
                        queryString = WhistleOut.updateQueryStringParameter(queryString, 'simonly', true);
                    } else if (simType) {
                        queryString = WhistleOut.updateQueryStringParameter(queryString, 'simonly', true);
                        queryString = WhistleOut.updateQueryStringParameter(queryString, 'simtype', simType);
                    }

                    if (data && data !== '0') {
                        queryString = WhistleOut.updateQueryStringParameter(queryString, 'data', data);
                    }

                    if (detectLocation === true || detectLocation === 'True') {
                        WhistleOut.getCurrentLocation(
                            function(e) {
                                var address = e.label;
                                if (address && address.length > 1) {
                                    queryString = WhistleOut.updateQueryStringParameter(queryString, 'address', address.replace(/\s+/g, '+'));
                                }
                                doSearch(searchUrl + queryString);
                            },
                            function() {
                                doSearch(searchUrl + queryString);
                            });
                    } else {
                        doSearch(searchUrl + queryString);
                    }
                });

            }

        }

        WhistleOut.initWidget = controller.init;
        controller.init();
    });

})();