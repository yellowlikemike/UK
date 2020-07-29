var WhistleOut = {};

(function () {
    'use strict';

    window.wo$ = jQuery.noConflict();
    window.dispatchEvent(new CustomEvent('jQueryReady'));
    var retailSplashTimer;
    var scrollDefaultDuration = 500;
    var scrollDefaultOffset = -100;

    WhistleOut.readLookupData = function (parent, force) {
        if (!parent) throw Error('parent needs to be provided');

        if (force === true) {
            // Use attr instead to prevent jquery from caching client side data as it does not get updated when DOM is manipulated
            return wo$.parseJSON(parent.find('div[data-client-side-data]').attr('data-client-side-data'));
        }

        return parent.find('div[data-client-side-data]').data('clientSideData');
    };

    WhistleOut.setLookupData = function (parent, data) {
        if (!parent) throw Error('parent needs to be provided');
        return parent.find('div[data-client-side-data]')
            .data('clientSideData', data);
    };

    WhistleOut.getCurrentLocation = function (successCallback, failCallback) {
        WhistleOut.getCurrentLocationViaHtml5(successCallback, function () {
            WhistleOut.getCurrentLocationViaApi(successCallback, failCallback);
        });
    };

    WhistleOut.getCurrentLatLng = function (successCallback, failCallback) {
        WhistleOut.getCurrentLatLngViaHtml5(successCallback, function () {
            WhistleOut.getCurrentLatLngViaApi(successCallback, failCallback);
        });
    };

    WhistleOut.getCurrentLatLngViaHtml5 = function (successCallback, failCallback) {
        if ('geolocation' in navigator && (WhistleOut.getSiteConfiguration() || {}).enableHtml5Geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                successCallback({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            }, failCallback);
        } else {
            if (failCallback) failCallback();
        }
    };

    WhistleOut.getCurrentLocationViaHtml5 = function (successCallback, failCallback) {
        WhistleOut.getCurrentLatLngViaHtml5(function (latLng) {
            var lat = latLng.lat;
            var lng = latLng.lng;
            wo$.ajax({
                type: 'GET',
                url: '/Ajax/Shared/Geo/Geocode?' + 'lat=' + lat + '&lng=' + lng,
                success: function (addressResult) {
                    addressResult.street = null;
                    addressResult.streetNumber = null;
                    if (!addressResult.city || addressResult.city.length < 1) {
                        if (failCallback) failCallback();
                        return;
                    }
                    successCallback({
                        label: WhistleOut.getLabel(addressResult),
                        lat: lat,
                        lng: lng,
                        countryCode: (addressResult.country || {}).shortName
                    });
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    return failCallback({
                        jqXHR: jqXHR,
                        textStatus: textStatus,
                        errorThrown: errorThrown
                    });
                }
            });
        }, failCallback);
    };

    WhistleOut.getCurrentLatLngViaApi = function (successCallback, failCallback) {
        var cookie = WhistleOut.getLocationCookie();
        if (cookie) {
            successCallback(cookie);
            return;
        }

        wo$.ajax({
            url: '/Ajax/Shared/Geo/GetCurrentCity',
            dataType: 'json',
            success: function (response) {

                if (!response.city || response.city.length < 1) {
                    if (failCallback) failCallback();
                    return;
                }

                response.postal = null;

                var res = {
                    lat: response.location.latitude,
                    lng: response.location.longitude,
                    countryCode: response.country.iso_code,
                    label: WhistleOut.getLabelFromMaxMind(response)
                };
                WhistleOut.setLocationCookie(res);
                successCallback(res);

            },
            error: function (jqXHR, textStatus, errorThrown) {
                return failCallback({
                    jqXHR: jqXHR,
                    textStatus: textStatus,
                    errorThrown: errorThrown
                });
            }
        });
    };

    WhistleOut.getCurrentLocationViaApi = function (successCallback, failCallback) {
        var cookie = WhistleOut.getLocationCookie();
        if (cookie && cookie.label) {
            successCallback(cookie);
            return;
        }

        var config = WhistleOut.getSiteConfiguration();
        if (!config || !config.autoDetectLocation) {
            if (failCallback) {
                failCallback();
                return;
            }
        }

        WhistleOut.getCurrentLatLngViaApi(function (addressResult) {
            
            successCallback(addressResult);

        }, failCallback);
    };

    WhistleOut.setLocationCookie = function (value) {
        if (typeof (window) == 'undefined' || !window || !window.wo$) {
            return;
        }

        var key = 'location';
        if (!value) {
            window.wo$.removeCookie(key);
            return;
        }

        var now = new Date();
        var time = now.getTime();
        var oneDay = 1 * 24 * 60 * 60;
        var expireTime = time + oneDay;
        now.setTime(expireTime);

        window.wo$.cookie(key, JSON.stringify(value), { path: '/', expires: now });
    };

    WhistleOut.getLocationCookie = function () {
        var cookie = window.wo$.cookie('location');
        return cookie ? JSON.parse(cookie) : null;
    };

    WhistleOut.getLabel = function (address) {
        var label;
        if (address.streetNumber || address.street) {
            label = this.getComponentValue(address.streetNumber) +
                ' ' +
                this.getComponentValue(address.street, true) +
                ' ' +
                this.getComponentValue(address.city) +
                ', ' +
                this.getComponentValue(address.state, true) +
                ' ' +
                this.getComponentValue(address.postcode);
        }
        else if (address.postcode || address.city) {
            label = this.getComponentValue(address.city) +
                ', ' +
                this.getComponentValue(address.state, true) +
                ' ' +
                this.getComponentValue(address.postcode);
        }
        else if (address.state) {
            label = this.getComponentValue(address.state);
        } else {
            label = this.getComponentValue(address.country);
        }
        return label.trim();
    };

    WhistleOut.getLabelFromMaxMind = function (address) {
        var label;
        if (address.city) {
            label = address.city.names.en;
            if (address.subdivisions && address.subdivisions.length) {
                label = label + ' ' + address.subdivisions[0].iso_code;
            }
            if (address.postal) {
                label = label + ', ' + address.postal.code;
            }
        }
        else if (address.subdivisions.length) {
            label = address.subdivisinos[0].iso_code;
        } else {
            label = address.country.names.en;
        }
        return label.trim();
    };

    WhistleOut.getComponentValue = function (component, preferShorter) {
        if (!component)
            return '';
        if (preferShorter === true && component.shortName && component.shortName.length > 0)
            return component.shortName;
        return component.longName;
    };

    WhistleOut.createSlider = function (sliderElement, textElement, sliderConfig, format, onChange, rebind) {

        if (!sliderElement || !textElement || !sliderConfig) {
            return;
        }

        if (!rebind) {
            rebind = false;
        }

        if (!rebind) {
            sliderElement.noUiSlider({
                step: 1,
                behaviour: 'drag',
                connect: 'lower',
                format: format,
                range: { 'min': [0], 'max': [sliderConfig.pegs.length - 1] },
                start: [0]
            }).on({
                slide: function () {
                    var index = sliderElement.val();
                    var text = sliderConfig.pegs[index].text;
                    textElement.html(text);
                },
                set: function () {
                    var index = sliderElement.val();
                    sliderConfig.currentPeg = sliderConfig.pegs[index];
                    var text = sliderConfig.pegs[index].text;
                    textElement.html(text);
                },
                change: function () {
                    var index = sliderElement.val();
                    var currentPeg = sliderConfig.pegs[index];
                    sliderConfig.currentPeg = currentPeg;
                    if (onChange) {
                        onChange(currentPeg);
                    }
                }
            });
        }

        sliderElement.val(sliderConfig.currentPeg.index);
    };

    WhistleOut.createDoubleSlider = function (sliderElement, textElement, sliderConfig, format, onChange, textMaxElement, showMaxTextForFullRange) {

        sliderElement.noUiSlider({
            step: 1,
            behaviour: 'drag',
            format: format,
            connect: true,
            range: { 'min': [0], 'max': [sliderConfig.pegs.length - 1] },
            start: [0, sliderConfig.pegs.length - 1]
        }).on({
            slide: function () {
                var index = sliderElement.val();
                if (textMaxElement) {
                    textElement.html(sliderConfig.pegs[index[0]].text);
                    textMaxElement.html(sliderConfig.pegs[index[1]].text);
                } else {
                    var text = sliderConfig.pegs[index[0]].text + ' - ' + sliderConfig.pegs[index[1]].text;

                    // If default ranges replace with any
                    if (showMaxTextForFullRange && sliderConfig.pegs[index[0]].value === sliderConfig.pegs[0].value && sliderConfig.pegs[index[1]].value === sliderConfig.pegs[sliderConfig.pegs.length - 1].value) {
                        text = sliderConfig.pegs[index[1]].text;
                    }

                    textElement.html(text);
                }
            },
            set: function () {
                var index = sliderElement.val();
                sliderConfig.currentPeg1 = sliderConfig.pegs[index[0]];
                sliderConfig.currentPeg2 = sliderConfig.pegs[index[1]];
                if (textMaxElement) {
                    textElement.html(sliderConfig.pegs[index[0]].text);
                    textMaxElement.html(sliderConfig.pegs[index[1]].text);
                } else {
                    var text = sliderConfig.pegs[index[0]].text + ' - ' + sliderConfig.pegs[index[1]].text;

                    // If default ranges replace with any
                    if (showMaxTextForFullRange && sliderConfig.pegs[index[0]].value === sliderConfig.pegs[0].value && sliderConfig.pegs[index[1]].value === sliderConfig.pegs[sliderConfig.pegs.length - 1].value) {
                        text = sliderConfig.pegs[index[1]].text;
                    }

                    textElement.html(text);
                }
            },
            update: function () {
                var index = sliderElement.val();
                if (textMaxElement) {
                    textElement.html(sliderConfig.pegs[index[0]].text);
                    textMaxElement.html(sliderConfig.pegs[index[1]].text);
                } else {
                    var text = sliderConfig.pegs[index[0]].text + ' - ' + sliderConfig.pegs[index[1]].text;
                    textElement.html(text);
                }
            },
            change: function () {
                var index = sliderElement.val();
                sliderConfig.currentPeg1 = sliderConfig.pegs[index[0]];
                sliderConfig.currentPeg2 = sliderConfig.pegs[index[1]];
                if (onChange) {
                    onChange();
                }
            }
        }).val([sliderConfig.currentPeg1.index, sliderConfig.currentPeg2.index]);
    };

    WhistleOut.isiOS = function () {
        return navigator && navigator.platform &&
            /iP(hone|od|ad)/.test(navigator.platform);
    };

    WhistleOut.startProgress = function (parent, trickleRate, trickleSpeed, showSpinner) {
        var element = wo$(parent);
        if (element.length === 0)
            return;

        if (typeof (trickleRate) === 'undefined') trickleRate = 0.1;
        if (typeof (trickleSpeed) === 'undefined') trickleSpeed = 0.1;
        if (typeof (parent) === 'undefined') parent = document;

        NProgress.configure({
            parent: parent,
            trickleRate: trickleRate,
            trickleSpeed: trickleSpeed,
            showSpinner: showSpinner === undefined ? true : showSpinner
        });

        NProgress.start();
        element.block({ message: null });

        var endProgressTimer;
        if (WhistleOut.isiOS()) {
            // HACK: In iOS, the standard events such as 'pageshow', 'popstate' or 'unload' don't work when the page is cached
            // So we need to end the progress manually after an interval
            endProgressTimer = setTimeout(function () {
                WhistleOut.endProgress(parent);
            }, 5000);
        }

        // We need to explicitly call endProgress() if the page is from cache
        // otherwise the indicator never stops on History.Back in Safari,
        // because Safari reads the page from the AppCache
        window.addEventListener('pageshow', function (event) { WhistleOut.endProgressOnPageShow(event, parent, endProgressTimer); }, false);
    };

    WhistleOut.endProgressOnPageShow = function (event, parent, endProgressTimer) {
        if (event.persisted) {
            if (endProgressTimer) {
                // Disable the iOS hack, because it's a normal workflow
                clearTimeout(endProgressTimer);
            }

            WhistleOut.endProgress(parent);
        }

        window.removeEventListener('pageshow', WhistleOut.endProgressOnPageShow, false);
    };

    WhistleOut.endProgress = function (parent) {
        if (typeof (parent) === 'undefined') parent = document;
        NProgress.done();
        wo$(parent).unblock({ message: null });
    };

    WhistleOut.isPositiveNumber = function (value) {
        return (wo$.isNumeric(value) && value !== '-1' && value !== -1);
    };

    WhistleOut.isNumber = function (value) {
        return wo$.isNumeric(value);
    };

    WhistleOut.getQueryStringParameter = function (name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    };

    WhistleOut.updateQueryStringParameter = function (url, key, value) {
        if (url == null) return null;
        if (key == null) return url;

        var re = new RegExp('([?&])' + key + '=.*?(&|$)', 'i');
        var separator = url.indexOf('?') !== -1 ? '&' : '?';
        var result;
        if (url.match(re)) {
            if (value === null || typeof value === 'undefined' || value.length === 0) {
                result = url.replace(re, '$2');
            } else {
                result = url.replace(re, '$1' + key + '=' + value + '$2');
            }
        }
        else {
            if (value === null || typeof value === 'undefined' || value.length === 0) {
                result = url;
            } else {
                result = url + separator + key + '=' + value;
            }
        }

        return result;
    };

    WhistleOut.appendQueryParam = function (qieryString, param) {
        var value = qieryString;
        if (value.length > 0) value += '&';
        value += param;
        return value;
    };

    WhistleOut.replaceQueryString = function (url, newQuery) {
        if (url == null) return null;

        var regex = /\?(.*)$/gi;
        var newUrl = url.replace(regex, '');
        if (newQuery[0] !== '?')
            newUrl += '?';
        newUrl += newQuery;
        return newUrl;
    };

    WhistleOut.notifications = wo$.Callbacks('unique');

    // ReSharper disable once NativeTypePrototypeExtending
    String.prototype.replaceQueryString = function (newQuery) {
        var url = this;
        var regex = /\?(.*)$/gi;
        var newUrl = url.replace(regex, '');
        if (newQuery[0] !== '?')
            newUrl += '?';
        newUrl += newQuery;
        return newUrl;
    };

    if (!Array.prototype.filter) {
        // ReSharper disable once NativeTypePrototypeExtending
        Array.prototype.filter = function (fun /*, thisp */) {
            'use strict';

            if (this === void 0 || this === null)
                throw new TypeError();

            var t = Object(this);
            var len = t.length >>> 0;
            if (typeof fun !== 'function')
                throw new TypeError();

            var res = [];
            var thisp = arguments[1];
            for (var i = 0; i < len; i++) {
                if (i in t) {
                    var val = t[i]; // in case fun mutates this
                    if (fun.call(thisp, val, i, t))
                        res.push(val);
                }
            }

            return res;
        };
    }

    if (!Array.prototype.map) {
        // ReSharper disable once NativeTypePrototypeExtending
        Array.prototype.map = function (callback, thisArg) {

            var T, A, k;

            if (this == null) {
                throw new TypeError(' this is null or not defined');
            }

            // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
            var O = Object(this);

            // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
            // 3. Let len be ToUint32(lenValue).
            var len = O.length >>> 0;

            // 4. If IsCallable(callback) is false, throw a TypeError exception.
            // See: http://es5.github.com/#x9.11
            if (typeof callback !== 'function') {
                throw new TypeError(callback + ' is not a function');
            }

            // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
            if (thisArg) {
                T = thisArg;
            }

            // 6. Let A be a new array created as if by the expression new Array(len) where Array is
            // the standard built-in constructor with that name and len is the value of len.
            A = new Array(len);

            // 7. Let k be 0
            k = 0;

            // 8. Repeat, while k < len
            while (k < len) {

                var kValue, mappedValue;

                // a. Let Pk be ToString(k).
                //   This is implicit for LHS operands of the in operator
                // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
                //   This step can be combined with c
                // c. If kPresent is true, then
                if (k in O) {

                    // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                    kValue = O[k];

                    // ii. Let mappedValue be the result of calling the Call internal method of callback
                    // with T as the this value and argument list containing kValue, k, and O.
                    mappedValue = callback.call(T, kValue, k, O);

                    // iii. Call the DefineOwnProperty internal method of A with arguments
                    // Pk, Property Descriptor {Value: mappedValue, : true, Enumerable: true, Configurable: true},
                    // and false.

                    // In browsers that support Object.defineProperty, use the following:
                    // Object.defineProperty(A, Pk, { value: mappedValue, writable: true, enumerable: true, configurable: true });

                    // For best browser support, use the following:
                    A[k] = mappedValue;
                }
                // d. Increase k by 1.
                k++;
            }

            // 9. return A
            return A;
        };
    }

    WhistleOut.getAnalyticsClientSideData = function () {
        var analyticsContainer = wo$('#analytics-container');
        if (!analyticsContainer.length) return null;

        return WhistleOut.readLookupData(analyticsContainer);
    };

    WhistleOut.getSiteConfiguration = function () {
        if (WhistleOut.siteConfiguration) {
            return WhistleOut.siteConfiguration;
        }

        var siteConfigurationContainer = wo$('#site-configuration-container');
        var config = siteConfigurationContainer.length
            ? WhistleOut.readLookupData(siteConfigurationContainer)
            : null;

        WhistleOut.siteConfiguration = config;
        return config;
    };

    WhistleOut.trackEvent = function (category, action, label, value, fields) {
        var analyticsClientSideData = WhistleOut.getAnalyticsClientSideData();
        var config = analyticsClientSideData.config;
        var data = analyticsClientSideData.data;

        wo$.each(config.accounts, function (index, account) {
            if (!account.affiliateOwned && data.includeEventTracking) {
                try {
                    if (typeof fields === 'undefined') {
                        ga(account.trackerId + '.send', 'event', category, action, label, value);
                    } else {
                        ga(account.trackerId + '.send', 'event', category, action, label, value, fields);
                    }
                } catch (err) {
                }
            }
        });

        var tags = new Array();
        if (category)
            tags.push(category);
        if (action)
            tags.push(category + '-' + action);
        if (tags.length > 0) {
            window.hj = window.hj || function () { (hj.q = hj.q || []).push(arguments); };
            hj('tagRecording', tags);
        }
    };

    WhistleOut.trackPageView = function (url, values, isAjax, referrer) {
        var analyticsClientSideData = WhistleOut.getAnalyticsClientSideData();
        var config = analyticsClientSideData.config;
        var data = analyticsClientSideData.data;

        try {
            if (config.trackPageImpression) {

                if ((!url || url.length <= 0) && analyticsClientSideData.data)
                    url = data.trackingUrl;
                if (!url || url.length <= 0)
                    url = location.pathname + location.search;

                wo$.each(config.accounts, function (index, account) {
                    ga('create', account.accountNumber, { 'name': account.trackerId, 'useAmpClientId': true }, 'auto');
                    if (account.linkIdTracking) {
                        ga(account.trackerId + '.require', 'linkid');
                    }
                    if (account.optimizeAccount) {
                        ga(account.trackerId + '.require', account.optimizeAccount);
                    }
                    if (url && url.length > 0) {
                        ga(account.trackerId + '.set', 'page', url);
                    }
                    if (data.dimensions && data.dimensions.length > 0) {
                        wo$.each(data.dimensions, function (index, value) {
                            ga(account.trackerId + '.set', 'dimension' + (index + 1), value);
                        });
                    }
                    if (config.anonymiseTracking) {
                        ga(account.trackerId + '.set', 'anonymizeIp', true);
                    }
                    ga(account.trackerId + '.send', 'pageview');
                });

                if (data.includeWhistleOutTracking) {
                    if (!values || values.length <= 0) values = data.values;
                    if (!values || values.length <= 0) values = '|||||||||||||||||||';
                    if (isAjax !== true) isAjax = false;
                    if (!referrer) referrer = document.referrer;
                    var src = '/track?u=' + encodeURIComponent(url) + '&a=' + isAjax + '&v=' + values + '&p=' + data.productAreaId + '&af=' + config.affiliateId + '&ad=' + config.affiliateDomainId + '&tr=' + data.isTransaction + '&pr=' + data.isProduct + '&r=' + encodeURIComponent(referrer) + '&m=' + WhistleOut.isMobileDevice();
                    var image = new Image(1, 1);
                    image.src = src;
                    image.onload = function () { return; };
                }
            }
        } catch (err) {
        }
    };

    WhistleOut.isMobileDevice = function () {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    WhistleOut.isElementInView = function (element, fullyInView) {
        var pageTop = wo$(window).scrollTop();
        var pageBottom = pageTop + wo$(window).height();
        var elementTop = wo$(element).offset().top;
        var elementBottom = elementTop + wo$(element).height();

        if (fullyInView === true) {
            return ((pageTop < elementTop) && (pageBottom > elementBottom));
        } else {
            return ((elementTop <= pageBottom) && (elementBottom >= pageTop));
        }
    };

    WhistleOut.getAds = function (productArea) {
        var placements = wo$('[data-adplacement]');
        if (placements.length > 0) {
            var data = {
                productArea: productArea,
                url: location.pathname + location.search,
                placements: wo$.makeArray(placements.map(function () {
                    return {
                        name: wo$(this).data('adplacement'),
                        tab: wo$(this).data('tab')
                    };
                }))
            };
            wo$.ajax({
                url: '/Ajax/Shared/Ad/Get',
                data: data,
                dataType: 'json',
                type: 'POST',
                success: function (result) {
                    for (var x = 0; x < result.length; x++) {
                        WhistleOut.processAd(placements, result[x]);
                    }
                    WhistleOut.applyPopover();
                    WhistleOut.stopPropagation();
                    WhistleOut.bindSubscribe();
                    WhistleOut.notifications.fire('AdsLoaded', { ads: result });
                }
            });
        }
    };

    WhistleOut.processAd = function (placements, ad) {
        var filter = ad.Tab == null
            ? '[data-adplacement = "' + ad.Placement + '"]'
            : '[data-adplacement = "' + ad.Placement + '"][data-tab = "' + ad.Tab + '"]';
        var matchingPlacements = placements.filter(filter);
        if (matchingPlacements.length > 0) {
            var html = ad.Content;
            if (ad.TrackingHtml != null) {
                html += '<div style="display: none">' + ad.TrackingHtml + '</div>';
            }
            if (html === '' || html == null) {
                if (ad.Placement !== 'TopNav') {
                    matchingPlacements.slideUp(250, WhistleOut.setAd(matchingPlacements, null));
                }
            } else if (ad.Placement === 'StickyBottomStrip') {
                if (wo$('#suggested-articles').length === 0 && (typeof (wo$.cookie('ShowStickyBottomStrip')) == 'undefined' || wo$.cookie('ShowStickyBottomStrip') === null)) {
                    WhistleOut.setAd(matchingPlacements, ad);
                    matchingPlacements.each(function () {
                        WhistleOut.setStickyBottomStripAd(wo$(this), ad);
                    });
                }
            } else {
                WhistleOut.setAd(matchingPlacements, ad);
                matchingPlacements.slideDown(250);
            }
        }
    };

    WhistleOut.setAd = function (placements, ad) {
        var html = '';
        if (ad != null) {
            html = ad.Content;
            if (ad.TrackingHtml != null) {
                html += '<div style="display: none">' + ad.TrackingHtml + '</div>';
            }
        }
        placements.each(function () {
            var placement = wo$(this);
            if (placement.children().length === 0) {
                placement.html(html);
            } else {
                placement.children().first().html(html);
            }
            if (ad != null && ad.Id != null) {
                var label = placement.data('adplacement') + ': ' + ad.Name + ' (' + ad.Id + ')';
                WhistleOut.trackEvent('Ad', 'Show', label, { nonInteraction: true });
                placement.off('click').click(function () {
                    WhistleOut.trackEvent('Ad', 'Click', label);
                });
            }
        });
    };

    WhistleOut.setStickyBottomStripAd = function (placement, ad) {
        placement.affix({
            offset: { top: 400 }
        })
            .show()
            .find('[data-adclose]').off('click').on('click', function (event) {
                var expires = new Date();
                expires.setTime(expires.getTime() + (60 * 60 * 1000));
                wo$.cookie('ShowStickyBottomStrip', '0', { path: '/', expires: expires });
                placement.remove();
                var label = placement.data('adplacement') + ': ' + ad.Name + ' (' + ad.Id + ')';
                WhistleOut.trackEvent('Ad', 'Close', label);
                event.stopPropagation();
            });
    };

    WhistleOut.applyPopover = function (container) {
        if (typeof (container) === 'undefined') {
            wo$('[data-toggle="popover"]').popover();
            wo$('body').off('click', WhistleOut.hideAllPopovers).click(WhistleOut.hideAllPopovers);
            wo$('body').off('hidden.bs.popover').on('hidden.bs.popover', function (e) {
                if (wo$(e.target).data('bs.popover')) {
                    wo$(e.target).data('bs.popover').inState.click = false;
                }
            });
        } else {
            container.find('[data-toggle="popover"]').popover();
        }
    };

    WhistleOut.hideAllPopovers = function (e) {
        if (wo$('.popover.in').length > 0) {
            wo$('[data-toggle="popover"]')
                .each(function () {
                    var $this = wo$(this);
                    if (!$this.is(e.target) && $this.has(e.target).length === 0 && wo$('.popover').has(e.target).length === 0 && wo$('.popover').hasClass('in')) {
                        $this.popover('hide');
                    }
                });
        }
    };

    WhistleOut.triggerPopoverNotification = function(element, content, position) {
        if (typeof position == 'undefined') {
            position = 'right';
        }
        var popoverElement = wo$(element);
        popoverElement.popover({
            trigger: 'manual',
            placement: position,
            html: true,
            content: content
        });
        popoverElement.popover('show');
        setTimeout(function () {
            popoverElement.popover('hide');
        }, 1200);
    };

    WhistleOut.checkQueryParamExists = function (queryParam) {
        var url = location.href;
        if (url.indexOf('?' + queryParam + '=') !== -1)
            return true;
        else if (url.indexOf('&' + queryParam + '=') !== -1)
            return true;
        return false;
    };

    WhistleOut.storeSelectorModal = {
        show: function (selectedHandler) {
            var modal = wo$('#store-selector-modal');
            if (!modal.length) return;

            modal.keyup(function (e) {
                if (e.keyCode === 13) {
                    WhistleOut.submitStoreSelectorModal(selectedHandler);
                }
            });

            modal.find('#continue-button').click(function () { WhistleOut.submitStoreSelectorModal(selectedHandler); });
            var $staff = modal.find('#staff');
            if ($staff.length > 0) {
                $staff.typeahead({
                    minLength: 2,
                    items: 'all',
                    addItem: {
                        id: 0,
                        code: 'Other',
                        name: 'Other'
                    },
                    source: function (query, process) {
                        return wo$.ajax({
                            url: '/Store/FindStaff',
                            data: { search: query },
                            dataType: 'json',
                            type: 'POST',
                            success: function (json) {
                                return process(json);
                            }
                        });
                    },
                    afterSelect: function (item) {
                        $staff.data('id', item.id);
                        $staff.data('code', item.code);
                        $staff.data('name', item.name);
                    },
                    matcher: function () {
                        return true;
                    },
                    displayText: function (item) {
                        return item.code ? item.name + ' ' + '(' + item.code + ')' : item.name;
                    }
                });
            }

            var siteConfiguration = WhistleOut.getSiteConfiguration();
            var currentStoreId = wo$.cookie(siteConfiguration.selectedStoreCookieKey);
            if (currentStoreId) {
                modal.find('#store-select').val(currentStoreId);
            }

            modal.modal('show').on('shown.bs.modal', function () {
                modal.find('#staff').focus();
            });
        }
    };

    WhistleOut.submitStoreSelectorModal = function (selectedHandler) {
        var modal = wo$('#store-selector-modal');
        if (!modal.length) return;

        var selectedStoreId = modal.find('#store-select').val();

        var staff = modal.find('#staff');
        var selectedStaff = null;
        if (staff.length > 0) {
            selectedStaff = {
                id: staff.data('id'),
                code: staff.data('code'),
                name: staff.data('name')
            };
        }

        if (!selectedStoreId || selectedStoreId.length <= 0
            || (staff.length > 0 && (!selectedStaff || selectedStaff.id == undefined))) {
            modal.find('#store-error').show();
            return;
        }

        selectedHandler(selectedStoreId, selectedStaff);
        modal.find('#store-error').hide();
        modal.modal('hide');
    };

    WhistleOut.showStoreSelector = function () {
        var siteConfiguration = WhistleOut.getSiteConfiguration();
        if ((siteConfiguration && siteConfiguration.forceStoreSelection === true && (wo$.cookie(siteConfiguration.selectedStoreCookieKey) == null || wo$.cookie(siteConfiguration.selectedStoreCookieKey) === ''))
            || (siteConfiguration && siteConfiguration.forceStoreStaffSelection === true && (wo$.cookie(siteConfiguration.selectedStaffCookieKey) == null || wo$.cookie(siteConfiguration.selectedStaffCookieKey) === ''))
        ) {
            WhistleOut.storeSelectorModal.show(WhistleOut.selectStore);
        }
    };

    WhistleOut.resetStore = function () {
        var siteConfiguration = WhistleOut.getSiteConfiguration();
        wo$.removeCookie(siteConfiguration.selectedStoreCookieKey, { path: '/' });
        wo$.removeCookie(siteConfiguration.selectedStaffCookieKey, { path: '/' });
        location.reload(true);
    };

    WhistleOut.resetStaff = function (reload) {
        var siteConfiguration = WhistleOut.getSiteConfiguration();
        wo$.removeCookie(siteConfiguration.selectedStaffCookieKey, { path: '/' });
        if (reload) {
            location.reload(true);
        }
    };

    WhistleOut.selectStore = function (selectedStoreId, selectedStaff) {
        var expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        wo$.cookie(WhistleOut.getSiteConfiguration().selectedStoreCookieKey, selectedStoreId, { path: '/', expires: expires });

        if (selectedStaff) {
            wo$.cookie.json = true;
            wo$.cookie(WhistleOut.getSiteConfiguration().selectedStaffCookieKey, selectedStaff, { path: '/', expires: expires });
            wo$.cookie.json = false;
        }

        location.reload(true);
    };

    WhistleOut.getStaff = function () {
        wo$.cookie.json = true;
        var value = wo$.cookie(WhistleOut.getSiteConfiguration().selectedStaffCookieKey);
        wo$.cookie.json = false;
        return value;
    };

    WhistleOut.getStaffId = function () {
        var staff = WhistleOut.getStaff();
        return staff ? staff.id : '';
    };

    WhistleOut.getStaffCode = function () {
        var staff = WhistleOut.getStaff();
        return staff ? staff.code : '';
    };

    WhistleOut.getStaffName = function () {
        var staff = WhistleOut.getStaff();
        return staff ? staff.name : '';
    };

    WhistleOut.getStoreName = function () {
        return WhistleOut.getSiteConfiguration().storeName;
    };

    WhistleOut.getStoreEmail = function () {
        return WhistleOut.getSiteConfiguration().storeEmail;
    };

    WhistleOut.bindStateSwitcher = function () {
        try {
            var $container = wo$('#state-switcher-container');
            if ($container.length === 0)
                return;

            var $province = $container.find('#province');
            if ($province && $province.length > 0) {
                WhistleOut.applySelectPicker($province);
                WhistleOut.applySelectPickersStyle();

                if (typeof (wo$.cookie('state')) !== 'undefined' && wo$.cookie('state') !== null) {
                    $province.selectpicker('val', wo$.cookie('state'));
                }

                $province.on('change', function () {
                    var href;
                    if (this.value === null || this.value === '') {
                        wo$.removeCookie('state', { path: '/' });
                        href = WhistleOut.updateQueryStringParameter(location.href, 'state', null);
                    }
                    else {
                        href = WhistleOut.updateQueryStringParameter(location.href, 'state', this.value);
                    }
                    if (href === location.href)
                        window.location.reload(true);
                    else
                        location.href = href;
                });
            }
        } catch (e) {
            console.log('Error in WhistleOut.bindStateSwitcher:', e);
        }
    };

    WhistleOut.bindModalLinks = function () {
        try {
            wo$('.js-modal-link').magnificPopup({
                type: 'iframe',
                removeDelay: 160,
                preloader: false,
                fixedContentPos: false
            });
        } catch (e) {
            console.log('Error in WhistleOut.bindModalLinks:', e);
        }
    };

    WhistleOut.bindTextAdLinks = function () {
        wo$('#text-ads a').click(function () {
            var label = wo$(this).html();
            WhistleOut.trackEvent('TextAd', 'Click', label);
        });
    };

    WhistleOut.bindExpressResults = function () {
        wo$('#express-results-stop, #express-results-stop2').click(function () {
            wo$.removeCookie('expressmode', { path: '/' });
            var href = WhistleOut.updateQueryStringParameter(location.href, 'express', null);

            if (href === location.href)
                window.location.reload(true);
            else
                location.href = href;
        });
    };

    WhistleOut.bindRetailSplash = function () {
        WhistleOut.startRetailSplashTimer();
        wo$(document).on('click keydown keyup mousemove scroll', WhistleOut.startRetailSplashTimer);
    };

    WhistleOut.startRetailSplashTimer = function () {
        if (retailSplashTimer) {
            window.clearTimeout(retailSplashTimer);
        }
        retailSplashTimer = window.setTimeout(function () {
            if (wo$('#store-selector-modal').hasClass('in')) {
                WhistleOut.startRetailSplashTimer();
                return;
            }

            wo$('#chatlio-widget').hide();
            wo$('#modal-retail-splash').modal('show')
                .on('hide.bs.modal', function () {
                    WhistleOut.startRetailSplashTimer();
                    wo$('#chatlio-widget').show();
                });
        }, 300000);
    };

    WhistleOut.focusAndSelect = function (element, copyToClipboard) {
        var len = wo$(element).val().length;
        wo$(element)[0].setSelectionRange(0, len, 'backward');
        wo$(element).focus();
        if (copyToClipboard === true) {
            document.execCommand('Copy');
        }
    };

    WhistleOut.applySelectPicker = function (element, config) {
        if (!config) {
            config = {};
        }
        config.iconBase = 'fa';
        config.tickIcon = 'fa-check';

        element.selectpicker(config);
        element.selectpicker('refresh');
    };

    WhistleOut.applySelectPickersStyle = function (parent) {
        if (!parent) {
            parent = wo$('document,html');
        }
        parent.find('.filter-option').addClass('needsclick');
    };

    WhistleOut.stopPropagation = function () {
        wo$('[data-stop-propagation]').click(function (event) {
            event.stopPropagation();
        });
        wo$('.yamm .dropdown-menu').click(function (event) {
            var target = wo$(event.target);
            if (!target.is('a'))
                event.stopPropagation();
        });
    };

    WhistleOut.bindCta = function (parent) {
        if (!parent) parent = wo$(document);

        parent.find('a[data-cta]').click(function () {
            var $this = wo$(this);
            var action = $this.data('cta');
            var label = $this.data('supplier');
            WhistleOut.trackEvent('Transaction', action, label);
        });
    };

    WhistleOut.bindClickUrl = function () {
        wo$('[data-click-url]').click(function () {
            var url = wo$(this).data('click-url');
            if (url) {
                location.href = url;
            }
        });
    };

    WhistleOut.bindTrackClick = function () {
        wo$('[data-track-click]').click(function () {
            var url = wo$(this).data('track-click');
            if (url) {
                var html = '<iframe src="' + url + '" style="display: none"></iframe>';
                wo$('body').append(html);
            }
        });
    };

    WhistleOut.applyPromoAds = function (element) {
        element.find('[data-promo-click]').click(function (e) {
            e.stopPropagation();
            var parent = wo$(this).closest('[data-promo-url]');
            var supplier = parent.data('supplier');
            var url = parent.data('promo-url');
            WhistleOut.trackEvent('DealStrip', 'Click', supplier);
            window.open(url, '_blank');
        });
    };

    WhistleOut.checkSiteQueryString = function () {
        var state = WhistleOut.getQueryStringParameter('state');
        if (state !== null) {
            if (state === '')
                wo$.removeCookie('state', { path: '/' });
            else
                wo$.cookie('state', state, { path: '/', expires: 31 });
        }

        var express = WhistleOut.getQueryStringParameter('express');
        if (express !== null) {
            wo$.cookie('expressmode', true, { path: '/', expires: 60 });
        }
    };

    WhistleOut.initHistoryTracker = function (obj) {
        // https://gist.github.com/kandadaboggu/4638701
        obj.HistoryWrapper = {
            apiEventInProgress: false,

            isBrowserEvent: function () {
                return !this.apiEventInProgress;
            },

            getState: function () {
                return window.History.getState();
            },

            silentExecute: function (f, data, title, url) {
                this.apiEventInProgress = true;
                var reply = f(data, title, url);
                this.apiEventInProgress = false;
                return reply;
            },

            pushState: function (data, title, url) {
                return this.silentExecute(window.History.pushState, data, title, url);
            },

            replaceState: function (data, title, url) {
                return this.silentExecute(window.History.replaceState, data, title, url);
            },

            onPopState: function (f) {
                var wrapper = this;
                window.History.Adapter.bind(window, 'statechange', function () {
                    if (wrapper.isBrowserEvent()) {
                        f();
                    }
                });
            }
        };

        obj.HistoryWrapper.onPopState(function () {
            //Triggered when Back/Forward button clicked
            location.reload();
        });
    };

    WhistleOut.scrollTo = function (target, scrollDuration, scrollOffset) {
        if (typeof scrollDuration == 'undefined') {
            scrollDuration = scrollDefaultDuration;
        }
        if (typeof scrollOffset == 'undefined') {
            scrollOffset = scrollDefaultOffset;
        }
        wo$.scrollTo(target, scrollDuration, {
            offset: scrollOffset
        });
    };

    WhistleOut.bindScrollTo = function () {
        wo$('a[data-scrollto]').on('click',
            function (e) {
                e.stopPropagation();
                e.preventDefault();
                var target = wo$(this).data('scrollto');
                var scrollDuration = wo$(this).data('scrollduration') || scrollDefaultDuration;
                var scrollOffset = wo$(this).data('scrolloffset') || scrollDefaultOffset;
                WhistleOut.scrollTo(target, scrollDuration, scrollOffset);
            });
    };

    WhistleOut.bindShow = function () {
        wo$('a[data-show]').on('click',
            function () {
                var target = wo$(this).data('show');
                wo$(target).show();
            });
    };

    WhistleOut.bindFocusAndSelect = function () {
        wo$('input[data-focusandselect]').on('click',
            function () {
                WhistleOut.focusAndSelect(this);
            });
    };

    WhistleOut.bindTrackEvent = function () {
        wo$('[data-trackevent]').on('click', function () {
            var category = wo$(this).data('category');
            var action = wo$(this).data('action');
            var label = wo$(this).data('label');
            WhistleOut.trackEvent(category, action, label);
        });
    };

    WhistleOut.bindSlick = function () {
        wo$('.slick-container .responsive').slick({
            dots: true,
            infinite: false,
            speed: 500,
            slidesToShow: 14,
            slidesToScroll: 14,
            responsive: [{
                breakpoint: 1200,
                settings: {
                    slidesToShow: 10,
                    slidesToScroll: 10,
                    infinite: true,
                    dots: true
                }
            }, {
                breakpoint: 992,
                settings: {
                    slidesToShow: 6,
                    slidesToScroll: 6,
                    dots: true
                }
            }, {
                breakpoint: 768,
                settings: {
                    slidesToShow: 3,
                    slidesToScroll: 3,
                    dots: false
                }
            }]
        }).show();
    };

    WhistleOut.getRemarketingData = function () {
        var remarketing = wo$('#remarketing');
        return remarketing.length === 0 ? null : WhistleOut.readLookupData(remarketing);
    };

    WhistleOut.remarketing = function (data) {
        var trackingCode = WhistleOut.getSiteConfiguration().remarketingTrackingCode;
        if (data && typeof gtag !== 'undefined' && trackingCode) {
            gtag('event', 'conversion',
                {
                    'allow_custom_scripts': true,
                    'send_to': trackingCode,
                    'u1': data.supplier ? data.supplier : '',
                    'u2': data.data ? data.data : '',
                    'u3': data.planType ? data.planType : '',
                    'u4': data.phoneBrand ? data.phoneBrand : '',
                    'u5': data.phone ? data.phone : '',
                    'u6': data.tags ? data.tags : '',
                    'u7': data.connectionType ? data.connectionType : '',
                    'u8': data.bundles ? data.bundles : '',
                    'u9': data.numberOfLines ? data.numberOfLines : '',
                    'u10': data.postcode ? data.postcode : '',
                    'u11': data.tabletBrand ? data.tabletBrand : '',
                    'u12': data.tablet ? data.tablet : ''
                });
        }
    };

    WhistleOut.bindGenericCallback = function () {
        wo$('[data-callback]').each(function () {
            var form = wo$(this);
            form.find('[data-submit]').off('click').on('click', function () {
                form.find('[data-success], [data-error]').hide();
                form.find('.has-error').removeClass('has-error');
                var $name = form.find('[data-name]');
                var $phone = form.find('[data-phone]');
                var $state = form.find('[data-state]');
                var data = {
                    name: $name.val().trim(),
                    phone: $phone.val().trim(),
                    time: form.find('[data-time]').val(),
                    state: $state.val()
                };
                var error = false;
                if (data.name === '') {
                    $name.parents('.form-group').addClass('has-error');
                    error = true;
                }
                var config = WhistleOut.getSiteConfiguration();
                var regex = new RegExp(config.regex.phone);
                if (data.phone === '' || !regex.test(data.phone)) {
                    $phone.parents('.form-group').addClass('has-error');
                    error = true;
                }
                if (data.state === '') {
                    $state.parents('.form-group').addClass('has-error');
                    error = true;
                }
                if (!error) {
                    wo$.ajax({
                        url: '/Ajax/Shared/Callback/SubmitGeneric',
                        type: 'POST',
                        data: data,
                        success: function () {
                            form.find('[data-intro]').hide();
                            form.find('[data-success]').show();
                            form.find('[data-name]').val('');
                            form.find('[data-phone]').val('');
                            form.find('[data-state]').val('');
                        },
                        error: function () {
                            form.find('[data-intro]').hide();
                            form.find('[data-error]').show();
                        }
                    });
                }
            });
        });
    };

    WhistleOut.checkAffiliateDomainCookie = function () {
        var config = WhistleOut.getSiteConfiguration();
        if (config) {
            if (config.affiliateDomainId === 0) {
                wo$.removeCookie(config.cookieName,
                    {
                        path: '/',
                        domain: config.cookieDomain
                    });
            } else if (config.cookieDuration && config.cookieDuration !== '') {
                var expires = new Date();
                if (config.cookieDuration === -1) {
                    expires.setTime(expires.getTime() + (525600 * 60 * 60 * 1000));
                } else {
                    expires.setTime(expires.getTime() + (config.cookieDuration * 60 * 1000));
                }
                wo$.cookie(config.cookieName, config.affiliateDomainId,
                    {
                        path: '/',
                        expires: expires,
                        domain: config.cookieDomain
                    });
            }
        }
    };

    WhistleOut.bindDataTables = function () {

        function applySorting(element, config) {
            var sort = element.find('th[data-order]');
            var index = sort.index();
            var direction = sort.data('order') || "asc";
            if (sort.length) {
                config.order = [[index, direction]];
            }
        }
        if (wo$.fn.dataTable) {
            wo$.fn.dataTable.ext.errMode = 'throw';
            wo$.extend(wo$.fn.dataTable.defaults, {
                "searching": false,
                "paging": false,
                "info": false,
                "ordering": true
            });

            wo$('.dataTables-sortableResponsive').each(function () {
                var config = {
                    "columnDefs": [
                        {
                            "orderable": false,
                            "targets": -1
                        },
                        {
                            "orderSequence": ["desc", "asc"],
                            "targets": '_all'
                        }
                    ],
                    "fixedHeader": {
                        headerOffset: 60
                    },
                    "responsive": {
                        "details": false
                    }
                };
                applySorting(wo$(this), config);
                wo$(this).DataTable(config);
            });

            wo$('.dataTables-Sortable').each(function () {
                var config = {
                    "columnDefs": [
                        {
                            "orderable": true
                        },
                        {
                            "orderSequence": ["desc", "asc"],
                            "targets": '_all'
                        }
                    ],
                    "fixedHeader": false,
                    "responsive": false
                };
                applySorting(wo$(this), config);
                wo$(this).DataTable(config);
            });

            wo$('.dataTables-notSortable').DataTable({
                "fixedHeader": {
                    headerOffset: 60
                },
                "responsive": {
                    "details": true
                },
                "ordering": false
            });

            wo$('.dataTables-fixedHeight').DataTable({
                "fixedHeader": false,
                "responsive": false,
                "ordering": false,
                "scrollY": "500px",
                "scrollX": true,
                "scrollCollapse": true
            });
        }
    };

    WhistleOut.bindCitiesAutoComplete = function (page) {
        var container = page.find('#cities');
        if (!container.length) return;

        var input = container.find('#search-city-input');
        input.val('');
        input.prop('disabled', false);

        var area = input.data('area');

        var icon = container.find('#city-search-icon');
        icon.removeClass();
        icon.addClass('fa fa-search');

        input.typeahead({
            selectOnBlur: false,
            minLength: 3,
            source: function (query, process) {
                return wo$.ajax({
                    url: '/Ajax/Shared/Geo/Cities?' + 'query=' + query + '&area=' + area,
                    dataType: 'json',
                    success: function (json) {
                        return process(json);
                    }
                });
            },
            afterSelect: function (item) {
                if (item.url) {
                    container.find('#search-city-input').prop('disabled', true);
                    var icon = container.find('#city-search-icon');
                    icon.removeClass();
                    icon.addClass('fa fa-spinner fa-fw fa-spin');
                    location.href = item.url;
                }
            },
            matcher: function () {
                return true;
            },
            displayText: function (item) {
                return item.displayText;
            }
        });

        container.find('#search-city-input').on('blur.bootstrap3Typeahead',
            function () {
                if (!container.find('#search-city-input').prop('disabled')) {
                    container.find('#search-city-input').val('');
                }
            });

    };

    WhistleOut.bindPhoneSpecsModal = function (container) {
        if (typeof (container) === 'undefined') {
            container = wo$('body');
        }
        container.find('a[data-phone-specs-button]').off('click').on('click',
            function () {
                var phoneShortUrl = wo$(this).data('phone-specs-button');
                if (!phoneShortUrl || phoneShortUrl.length < 1)
                    return;

                WhistleOut.hideAllPopovers(container);

                var phoneSpecsContainer = wo$('#phone-specs-container');
                if (phoneSpecsContainer && phoneSpecsContainer.length > 0 && phoneSpecsContainer.data('phone-short-url') === phoneShortUrl) {
                    phoneSpecsContainer.find('[data-phone-specs-modal]').modal('show');
                } else {
                    var data = {
                        phoneShortUrl: phoneShortUrl
                    };
                    var siteConfiguration = WhistleOut.getSiteConfiguration();
                    wo$.ajax({
                        url: siteConfiguration.phoneSpecsModalUrl,
                        data: data,
                        type: 'GET',
                        success: function (result) {
                            if (result !== '') {
                                if (!phoneSpecsContainer || phoneSpecsContainer.length < 1) {
                                    wo$('body').append('<div id="phone-specs-container"></div>');
                                    phoneSpecsContainer = wo$('#phone-specs-container');
                                }
                                phoneSpecsContainer.data('phone-short-url', phoneShortUrl);
                                phoneSpecsContainer.html(result);
                                phoneSpecsContainer.find('[data-phone-specs-modal]').modal('show');
                            }
                        }
                    });
                }
            });
    };

    WhistleOut.bindTabletSpecsModal = function (container) {
        if (typeof (container) === 'undefined') {
            container = wo$('body');
        }
        container.find('a[data-tablet-specs-button]').off('click').on('click',
            function () {
                var tabletShortUrl = wo$(this).data('tablet-specs-button');
                if (!tabletShortUrl || tabletShortUrl.length < 1)
                    return;

                WhistleOut.hideAllPopovers(container);

                WhistleOut.showTabletSpecs(tabletShortUrl);
            });
    };

    WhistleOut.showTabletSpecs = function (tabletShortUrl) {
        var tabletSpecsContainer = wo$('#tablet-specs-container');
        if (tabletSpecsContainer && tabletSpecsContainer.length > 0 && tabletSpecsContainer.data('tablet-short-url') === tabletShortUrl) {
            tabletSpecsContainer.find('[data-tablet-specs-modal]').modal('show');
        } else {
            var data = {
                tabletShortUrl: tabletShortUrl
            };
            var siteConfiguration = WhistleOut.getSiteConfiguration();
            wo$.ajax({
                url: siteConfiguration.tabletSpecsModalUrl,
                data: data,
                type: 'GET',
                success: function (result) {
                    if (result !== '') {
                        if (!tabletSpecsContainer || tabletSpecsContainer.length < 1) {
                            wo$('body').append('<div id="tablet-specs-container"></div>');
                            tabletSpecsContainer = wo$('#tablet-specs-container');
                        }
                        tabletSpecsContainer.data('tablet-short-url', tabletShortUrl);
                        tabletSpecsContainer.html(result);
                        tabletSpecsContainer.find('[data-tablet-specs-modal]').modal('show');
                    }
                }
            });
        }
    };

    WhistleOut.bindPhoneGallery = function (container) {
        if (typeof (container) === 'undefined') {
            container = wo$('body');
        }
        container.find('a[data-phone-gallery-button]').off('click').on('click',
            function () {
                var link = wo$(this);
                var phoneShortUrl = link.data('phone-gallery-button');
                if (!phoneShortUrl || phoneShortUrl.length < 1)
                    return;

                WhistleOut.hideAllPopovers(container);

                var data = {
                    phoneShortUrl: phoneShortUrl
                };
                var siteConfiguration = WhistleOut.getSiteConfiguration();
                wo$.ajax({
                    url: siteConfiguration.phoneGalleryUrl,
                    data: data,
                    type: 'GET',
                    success: function (result) {
                        if (result !== '') {

                            var items = [];
                            wo$.each(result,
                                function (index, item) {
                                    items.push({ src: item });
                                });

                            wo$.magnificPopup.open({
                                items: items,
                                type: 'image',
                                gallery: {
                                    enabled: true
                                }
                            });
                        }
                    }
                });
            });
    };

    WhistleOut.showTabletGallery = function (tabletShortUrl) {
        var data = {
            tabletShortUrl: tabletShortUrl
        };
        var siteConfiguration = WhistleOut.getSiteConfiguration();
        wo$.ajax({
            url: siteConfiguration.tabletGalleryUrl,
            data: data,
            type: 'GET',
            success: function (result) {
                if (result !== '') {

                    var items = [];
                    wo$.each(result,
                        function (index, item) {
                            items.push({ src: item });
                        });

                    wo$.magnificPopup.open({
                        items: items,
                        type: 'image',
                        gallery: {
                            enabled: true
                        }
                    });
                }
            }
        });
    };

    WhistleOut.bindTabletGallery = function (container) {
        if (typeof (container) === 'undefined') {
            container = wo$('body');
        }
        container.find('a[data-tablet-gallery-button]').off('click').on('click',
            function () {
                var link = wo$(this);
                var tabletShortUrl = link.data('tablet-gallery-button');
                if (!tabletShortUrl || tabletShortUrl.length < 1)
                    return;

                WhistleOut.hideAllPopovers(container);

                WhistleOut.showTabletGallery(tabletShortUrl);
            });
    };

    WhistleOut.bindSubscribe = function () {
        var config = WhistleOut.getSiteConfiguration();
        wo$('[data-subscribe]:not([data-bound])').each(
            function () {
                var $this = wo$(this);
                var email = $this.find('[data-email]');
                $this.find('[data-submit]').off('click').on('click',
                    function () {
                        $this.find('[data-error]').hide();
                        var regex = new RegExp(config.regex.email);
                        if (!email.val() || !regex.test(email.val())) {
                            $this.find('[data-info]').hide();
                            $this.find('[data-validate]').show();
                            return;
                        }
                        if (!$this.find('[data-consent]').is(':checked')) {
                            $this.find('[data-info]').hide();
                            $this.find('[data-validate]').show();
                            return;
                        }
                        var data = {
                            email: email.val(),
                            listId: $this.data('listid')
                        };
                        wo$.ajax({
                            url: config.subscribeUrl,
                            data: data,
                            type: 'POST',
                            success: function () {
                                $this.find('[data-formrow]').hide();
                                $this.find('[data-success]').show();
                            },
                            error: function () {
                                $this.find('[data-error]').show();
                            },
                            complete: function () {
                                $this.find('[data-info]').hide();
                                $this.find('[data-validate]').hide();
                            }
                        });
                    });
                $this.attr('data-bound', true);
            });
    };

})();

wo$(function () {
    WhistleOut.checkSiteQueryString();
    wo$.blockUI.defaults.overlayCSS = {};
    WhistleOut.applyPopover();
    WhistleOut.showStoreSelector();
    WhistleOut.bindStateSwitcher();
    WhistleOut.bindModalLinks();
    WhistleOut.bindTextAdLinks();
    WhistleOut.bindExpressResults();
    WhistleOut.bindRetailSplash();
    WhistleOut.stopPropagation();
    WhistleOut.bindClickUrl();
    WhistleOut.bindTrackClick();
    WhistleOut.bindTrackEvent();
    WhistleOut.bindShow();
    WhistleOut.bindScrollTo();
    WhistleOut.bindFocusAndSelect();
    WhistleOut.bindGenericCallback();
    WhistleOut.checkAffiliateDomainCookie();
    WhistleOut.bindPhoneSpecsModal();
    WhistleOut.bindTabletSpecsModal();
    WhistleOut.bindPhoneGallery();
    WhistleOut.bindTabletGallery();
    WhistleOut.bindSubscribe();
    WhistleOut.bindDataTables();
});
