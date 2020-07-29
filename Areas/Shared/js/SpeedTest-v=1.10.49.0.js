(function () {
    "use strict";
    var wo$ = window.wo$;
    WhistleOut.SpeedTest = {};
    WhistleOut.SpeedTest.getSpeedTestParameters = function (successCallback, failedCallback) {
        var cookieValue = wo$.cookie('woSpeedTest');
        if (cookieValue) {
            successCallback(JSON.parse(cookieValue));
            return;
        }
        var mlabNsService = 'https:' == location.protocol ? 'ndt_ssl' : 'ndt';
        var mlabNsUrl = 'https://mlab-ns.appspot.com/';
        wo$.ajax({
            url: mlabNsUrl + mlabNsService + '?format=json',
            dataType: 'json',
            success: function (resp) {
                wo$.cookie('woSpeedTest', JSON.stringify(resp), { path: '/', expires: 1 });
                successCallback(resp);
            },
            error: function (jqXHR, errStatus, errText) {
                failedCallback(jqXHR, errStatus, errText);
            }
        });
    };
    WhistleOut.SpeedTest.testSpeed = function (server, testDownloadSpeed, testUploadSpeed, callback) {
        var client = null;
        function getNumber(value) {
            if (value && !isNaN(value))
                return value;
            return null;
        };
        function getJustfiedSpeed(speedInKB) {
            var e = Math.floor(Math.log(speedInKB) / Math.log(1000));
            var fixedNum = 2;
            if (speedInKB > 100) {
                fixedNum = 0;
            } else if (speedInKB > 10) {
                fixedNum = 1;
            }
            return (speedInKB / Math.pow(1000, e)).toFixed(fixedNum);
        };

        function updateUploadSpeeds(result) {
            result.uploadSpeedDone = false;
            if (result.status === 'Outbound' || result.status === 'Inbound') {
                var value = getNumber(client.getNDTvar('ClientToServerSpeed'));
                if (value != null) {
                    result.uploadSpeed = getJustfiedSpeed(value);
                    if (result.status === 'Inbound') {
                        result.uploadSpeedDone = true;
                    }
                } else {
                    result.uploadSpeed = null;
                }
            }
        };
        function updateDownloadSpeeds(result) {
            if (result.status === 'Inbound') {
                var value = getNumber(client.getNDTvar('ServerToClientSpeed'));
                if (value != null) {
                    result.downloadSpeed = getJustfiedSpeed(value);
                } else {
                    result.downloadSpeed = null;
                }
            }
        };
        function refreshSpeed(callback) {
            var message = client.get_errmsg();
            var status = client.get_status();
            var isCompleted = message === 'Test completed';
            var hasErrors = message !== 'Test completed' && message.length > 0;
            var latency = getNumber(client.getNDTvar('avgrtt'));
            console.log(message);
            var result = {
                "status": status,
                "isCompleted": isCompleted,
                "hasErrors" : hasErrors
            };
            updateUploadSpeeds(result);
            updateDownloadSpeeds(result);
            if (!isCompleted && !hasErrors) {
                callback(result);
                setTimeout(function () { refreshSpeed(callback); }, 1000);
            } else {
                if (latency) {
                    result.latency = getNumber(client.getNDTvar('avgrtt'));
                }
                result.lastResultDate = new Date();
                wo$.cookie('woSpeedTestResult', JSON.stringify(result), { path: '/', expires: 30 });
                callback(result);

                var event = {
                    type: 'woSpeedTest.resultUpdated',
                    detail: {
                        sender: this,
                        result: result
                    }
                };
                wo$.event.trigger(event);
            }
        };

        var testsToExecute = 32;
        if (testDownloadSpeed) {
            testsToExecute = 4 | testsToExecute;
        }
        if (testUploadSpeed) {
            testsToExecute = 2 | testsToExecute;
        }

        client = new NDTWrapper(server, testsToExecute);
        client.run_test(server);
        refreshSpeed(callback);
    };
    WhistleOut.SpeedTest.init = function (parent) {
        if (!parent)
            parent = wo$('body');
        var container = parent.find('div.speed-test-widget');
        var speedTiers = container.data('speed-tiers');
        var displayError = function (instance) {
            instance.find('div[data-stage-progress]').addClass('hidden');
            instance.find('div[data-stage-error]').removeClass('hidden');
            wo$.cookie('woSpeedTest', null, { path: '/', expires: -1 });
        };
        var testUpload = function (server, instance) {
            try {
                WhistleOut.SpeedTest.testSpeed(server, false, true, function (result) {
                    if (result.uploadSpeed)
                        instance.find('span[data-current-upload]').text(result.uploadSpeed);
                    if (result.hasErrors && !result.uploadSpeed) {
                        wo$.cookie('woSpeedTest', null, { path: '/', expires: -1 });
                        instance.find('span[data-current-upload]').text('-');
                    }
                    if (result.isCompleted || result.hasErrors) {
                        instance.find('button[data-download-start]').removeAttr('disabled');
                        instance.find('span[data-current-upload]').parent().removeClass('c-gray-light');
                        instance.find('span[data-current-upload]').prev().addClass('hidden');
                    }
                    console.log(result);
                });
            } catch (e) {
                displayError(instance);
            }
        };
        var testDownload = function (server, instance) {
            try {
                WhistleOut.SpeedTest.testSpeed(server,
                    true,
                    false,
                    function (result) {
                        if (result.downloadSpeed)
                            instance.find('span[data-current-download]').text(result.downloadSpeed);
                        if (result.hasErrors && !result.downloadSpeed) {
                            displayError(instance);
                        } else if (result.isCompleted || result.hasErrors) {
                            var tier = speedTiers.findIndex(function (e) { return e > result.downloadSpeed * 1000 }) + 1;
                            instance.find('span[data-current-tier]').removeClass();
                            instance.find('span[data-current-tier]').addClass('fa font-10 fa-speed-' + tier);
                            instance.find('div[data-stage-progress]').addClass('hidden');
                            instance.find('div[data-stage-results]').removeClass('hidden');
                            instance.find('span[data-latency]').text(result.latency);
                        }
                        console.log(result);
                    });
            } catch (e) {
                displayError(instance);
            }

        };
        container.find('button[data-show-more-info]').off('click').on('click', function () {
            var instance = wo$(this).closest('div.speed-test-widget');
            wo$(this).addClass('hidden');
            wo$(this).next().find('div[data-more-info]').collapse('show');
            instance.find('span[data-current-upload]').text('0');
            instance.find('span[data-current-upload]').parent().addClass('c-gray-light');
            instance.find('span[data-current-upload]').prev().removeClass('hidden');
            instance.find('button[data-download-start]').attr('disabled', 'disabled');
            WhistleOut.SpeedTest.getSpeedTestParameters(function (resp) {
                testUpload(resp.fqdn, instance);
            }, function () {
                displayError(instance);
            });
        });
        container.find('button[data-download-start]').off('click').on('click', function () {
            var instance = wo$(this).closest('div.speed-test-widget');
            instance.find('button[data-show-more-info]').removeClass('hidden');
            instance.find('div[data-more-info]').collapse('hide');
            instance.find('div[data-stage-error]').addClass('hidden');
            instance.find('div[data-stage-begin]').addClass('hidden');
            instance.find('div[data-stage-results]').addClass('hidden');
            instance.find('div[data-stage-progress]').removeClass('hidden');
            instance.find('span[data-current-download]').text('0');
            WhistleOut.SpeedTest.getSpeedTestParameters(function (resp) {
                instance.find('span[data-server-location]').text(resp.city + ', ' + resp.country);
                testDownload(resp.fqdn, instance);
            }, function () {
                displayError(instance);
            });
        });
        var speedTestResult = wo$.cookie('woSpeedTestResult');
        if (speedTestResult && speedTestResult.length) {
            speedTestResult = JSON.parse(speedTestResult);
            var dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
            container.find('[data-speed-test-date]')
                .text(new Date(speedTestResult.lastResultDate).toLocaleDateString('en-AU', dateOptions));
            container.find('[data-speed-test-result]').text(speedTestResult.downloadSpeed);
            container.find('[data-last-test]').removeClass('hidden');
        } else {
            container.find('[data-last-test]').addClass('hidden');
        }
    }
})();
wo$(function () {
    WhistleOut.SpeedTest.init(wo$('body'));
});