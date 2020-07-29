(function () {
    "use strict";
    var wo$ = window.wo$;
    var WhistleOut = window.WhistleOut;

    wo$(function () {

        var controller = {
            init: function () {
                var widget = wo$('[data-widget-type="mobile-phone-search"]');
                if (!widget.length) return;

                widget.find('#change-usage').off('click').on('click', function () {
                    WhistleOut.trackEvent('MobilePhoneSearch', 'ChangeUsage');
                });
                widget.find('#view-full-results').off('click').on('click', function () {
                    WhistleOut.trackEvent('MobilePhoneSearch', 'ViewFullResults');
                });
                widget.find('[data-transaction]').off('click').each(function () {
                });
                widget.find('[data-transaction]').off('click').each(function () {
                    var $this = wo$(this);
                    var transaction = $this.data('transaction');
                    var supplier = $this.data('supplier');
                    if (transaction === 'GoToSite') {
                        var href = $this.attr('href');
                        $this.attr('href', href + (href.indexOf('?') === -1 ? '?' : '&') + 'r=' + encodeURIComponent(document.referrer));
                    }
                    $this.on('click', function() {
                        WhistleOut.trackEvent('MobilePhoneSearch', transaction, supplier);
                    });
                });
            }
        }

        WhistleOut.initWidget = controller.init;
        controller.init();
    });

})();