/*
 * ionic-google-places-autocomplete
 *
 * Copyright (c) 2015 "kuhnza" David Kuhn
 * Licensed under the MIT license.
 * https://github.com/1337/ionic-google-places-autocomplete/blob/master/LICENSE
 */
/*global angular*/
(function (undefined) {
    "use strict";

    var module = angular.module('google.places', ['ionic']),
        keymap = {
            tab: 9,
            enter: 13,
            esc: 27,
            up: 38,
            down: 40
        },
        hotkeys = [
            keymap.tab, keymap.enter, keymap.esc, keymap.up, keymap.down
        ];

    function googlePlacesApi($window) {
        if ($window && $window.google) {
            return $window.google;
        }
        throw 'Global `google` var missing. Did you forget to include the places API script?';
    }

    /**
     * Autocomplete directive. Use like this:
     *
     * <input type="text" g-places-autocomplete ng-model="myScopeVar" />
     */
    function gPlacesAutocomplete($compile, $document, google) {

        function indexOf(array, item) {
            var idx, length;

            if (array === null || array === undefined) {
                return -1;
            }

            length = array.length;
            for (idx = 0; idx < length; idx++) {
                if (array[idx] === item) {
                    return idx;
                }
            }
            return -1;
        }

        function link($scope, element, attrs, controller) {
            var autocompleteService = new google.maps.places.AutocompleteService(),
                placesService = new google.maps.places.PlacesService(element[0]);

            $scope.predictions = [];
            $scope.forceSelection = false;

            function initAutocompleteDrawer() {
                // Drawer element used to display predictions
                var drawerElement = angular.element(
                        '<div g-places-autocomplete-drawer></div>'
                    ),
                    body = angular.element($document[0].body),
                    $drawer;

                drawerElement.attr({
                    input: 'input',
                    query: 'query',
                    predictions: 'predictions',
                    active: 'active',
                    selected: 'selected'
                });

                $drawer = $compile(drawerElement)($scope);
                body.append($drawer);  // Append to DOM
            }

            function clearPredictions() {
                $scope.active = -1;
                $scope.selected = -1;
                $scope.predictions.length = 0;
            }

            function onKeydown(event) {
                if ($scope.predictions.length === 0 ||
                        indexOf(hotkeys, event.which) === -1) {
                    return;
                }

                event.preventDefault();

                if (event.which === keymap.down) {
                    $scope.active = ($scope.active + 1) % $scope.predictions.length;
                    $scope.$digest();
                } else if (event.which === keymap.up) {
                    if (!$scope.active) {
                        $scope.active -= 1;
                    } else {
                        $scope.active = $scope.predictions.length - 1;
                    }
                    $scope.$digest();
                } else if (event.which === keymap.enter || event.which === keymap.tab) {
                    if ($scope.forceSelection && $scope.active === -1) {
                        $scope.active = 0;
                    }

                    $scope.$apply(function () {
                        $scope.selected = $scope.active;

                        if ($scope.selected === -1) {
                            clearPredictions();
                        }
                    });
                } else if (event.which === keymap.esc) {
                    event.stopPropagation();
                    clearPredictions();
                    $scope.$digest();
                }
            }

            function onBlur() {
                if ($scope.predictions.length === 0) {
                    return;
                }

                if ($scope.forceSelection) {
                    if ($scope.selected === -1) {
                        $scope.selected = 0;
                    }
                }

                $scope.$digest();

                $scope.$apply(function () {
                    if ($scope.selected === -1) {
                        clearPredictions();
                    }
                });
            }

            function select() {
                var prediction = $scope.predictions[$scope.selected];
                if (!prediction) {
                    return;
                }

                if (prediction.is_custom) {
                    $scope.model = prediction.place;
                    $scope.$emit('g-places-autocomplete:select', prediction.place);
                    clearPredictions();
                    return;
                }

                placesService.getDetails(
                    {placeId: prediction.place_id},
                    function (place, status) {
                        if (status !== google.maps.places.PlacesServiceStatus.OK) {
                            return;
                        }
                        $scope.$apply(function () {
                            $scope.model = place;
                            $scope.$emit('g-places-autocomplete:select',
                                place);
                        });
                    }
                );
                clearPredictions();
            }

            function initEvents() {
                element.bind('keydown', onKeydown);
                element.bind('blur', onBlur);

                $scope.$watch('selected', select);
            }

            function parse(viewValue) {
                var request;

                if (!(viewValue && angular.isString(viewValue))) {
                    return viewValue;
                }

                $scope.query = viewValue;

                request = angular.extend({input: viewValue}, $scope.options);
                autocompleteService.getPlacePredictions(
                    request,
                    function (predictions, status) {
                        $scope.$apply(function () {
                            var customPlacePredictions;

                            clearPredictions();

                            if ($scope.customPlaces) {
                                customPlacePredictions = getCustomPlacePredictions(
                                    $scope.query
                                );
                                $scope.predictions.push.apply(
                                    $scope.predictions,
                                    customPlacePredictions
                                );
                            }

                            if (status === google.maps.places.PlacesServiceStatus.OK) {
                                $scope.predictions.push.apply(
                                    $scope.predictions,
                                    predictions
                                );
                            }

                            if ($scope.predictions.length > 5) {
                                $scope.predictions.length = 5;  // trim predictions down to size
                            }
                        });
                    }
                );

                return viewValue;
            }

            function format(modelValue) {
                var viewValue = "";

                if (angular.isString(modelValue)) {
                    viewValue = modelValue;
                } else if (angular.isObject(modelValue)) {
                    viewValue = modelValue.formatted_address;
                }

                return viewValue;
            }

            function render() {
                return element.val(controller.$viewValue);
            }

            function initNgModelController() {
                controller.$parsers.push(parse);
                controller.$formatters.push(format);
                controller.$render = render;
            }

            function getCustomPlacePredictions(query) {
                var predictions = [],
                    place,
                    match,
                    idx;

                for (idx = 0; idx < $scope.customPlaces.length; idx++) {
                    place = $scope.customPlaces[idx];

                    match = getCustomPlaceMatches(query, place);
                    if (match.matched_substrings.length <= 0) {
                        continue;
                    }
                    predictions.push({
                        is_custom: true,
                        custom_prediction_label: place.custom_prediction_label ||
                            '(Custom Non-Google Result)',  // required by https://developers.google.com/maps/terms § 10.1.1 (d)
                        description: place.formatted_address,
                        place: place,
                        matched_substrings: match.matched_substrings,
                        terms: match.terms
                    });
                }

                return predictions;
            }

            function toLower(string) {
                if (!string) {
                    return "";
                }
                return string.toLowerCase();
            }

            function startsWith(string1, string2) {
                return toLower(string1).lastIndexOf(toLower(string2), 0) === 0;
            }

            function getCustomPlaceMatches(query, place) {
                var q = query + '',  // make a copy so we don't interfere with subsequent matches
                    terms = [],
                    matchedSubstrings = [],
                    fragment,
                    termFragments,
                    idx;

                termFragments = place.formatted_address.split(',');
                for (idx = 0; idx < termFragments.length; idx++) {
                    fragment = termFragments[idx].trim();

                    if (q.length > 0) {
                        if (fragment.length >= q.length) {
                            if (startsWith(fragment, q)) {
                                matchedSubstrings.push({
                                    length: q.length,
                                    offset: idx
                                });
                            }
                            q = '';  // no more matching to do
                        } else {
                            if (startsWith(q, fragment)) {
                                matchedSubstrings.push({
                                    length: fragment.length,
                                    offset: idx
                                });
                                q = q.replace(fragment, '').trim();
                            } else {
                                q = '';  // no more matching to do
                            }
                        }
                    }

                    terms.push({
                        value: fragment,
                        offset: place.formatted_address.indexOf(fragment)
                    });
                }

                return {
                    matched_substrings: matchedSubstrings,
                    terms: terms
                };
            }

            $scope.query = '';
            $scope.predictions = [];
            $scope.input = element;
            $scope.options = $scope.options || {};

            initAutocompleteDrawer();
            initEvents();
            initNgModelController();
        }
        return {
            restrict: 'A',
            require: '^ngModel',
            scope: {
                model: '=ngModel',
                options: '=?',
                forceSelection: '=?',
                customPlaces: '=?'
            },
            controller: angular.noop,
            link: link
        };
    }

    function gPlacesAutocompleteDrawer($window, $document, $injector, $timeout) {
        var TEMPLATE = [
            '<div class="pac-container" ng-if="isOpen()" ng-style="{top: position.top+\'px\', left: position.left+\'px\', width: position.width+\'px\'}" style="display: block;" role="listbox" aria-hidden="{{!isOpen()}}">',
            '  <div class="pac-item" g-places-autocomplete-prediction index="$index" prediction="prediction" query="query"',
            '       ng-repeat="prediction in predictions track by $index" ng-class="{\'pac-item-selected\': isActive($index) }"',
            '       ng-mouseenter="selectActive($index)" ng-click="selectPrediction($index)" role="option" id="{{prediction.id}}">',
            '  </div>',
            '</div>'
        ];

        function getDrawerPosition(element) {
            var domEl = element[0],
                rect = domEl.getBoundingClientRect(),
                height,
                docEl = $document[0].documentElement,
                body = $document[0].body,
                scrollTop = $window.pageYOffset ||
                    docEl.scrollTop || body.scrollTop,
                scrollLeft = $window.pageXOffset ||
                    docEl.scrollLeft || body.scrollLeft;

            if (rect.height === undefined) {
                height = rect.bottom - rect.top;
            } else {
                height = rect.height;
            }

            return {
                width: rect.width,
                height: height,
                top: rect.top + height + scrollTop,
                left: rect.left + scrollLeft
            };
        }

        return {
            restrict: 'A',
            scope: {
                input: '=',
                query: '=',
                predictions: '=',
                active: '=',
                selected: '='
            },
            template: TEMPLATE.join(''),
            link: function ($scope, element) {
                element.bind('mousedown', function (event) {
                    event.preventDefault();  // prevent blur event from firing when clicking selection
                });

                $scope.isOpen = function () {
                    return $scope.predictions.length > 0;
                };

                $scope.isActive = function (index) {
                    return $scope.active === index;
                };

                $scope.selectActive = function (index) {
                    $scope.active = index;
                };

                $scope.selectPrediction = function (index) {
                    $scope.selected = index;
                };

                $scope.$watch('predictions.length', function () {
                    try {
                        var $ionicBackdrop = $injector.get('$ionicBackdrop');
                        if ($scope.predictions.length) {
                            $ionicBackdrop._element.css('background-color', 'transparent');
                            $ionicBackdrop.release();
                            $ionicBackdrop.retain();
                        } else {
                            $ionicBackdrop.release();
                            $timeout(function () {
                                $ionicBackdrop._element.css('background-color', '');
                            }, 200);
                        }
                    } catch (err) {
                        angular.noop(err);
                    }

                    $scope.position = getDrawerPosition($scope.input);
                });
            }
        };
    }

    function gPlacesAutocompletePrediction() {
        var TEMPLATE = [
            '<span class="pac-icon pac-icon-marker"></span>',
            '<span class="pac-item-query" ng-bind-html="prediction | highlightMatched"></span>',
            '<span ng-repeat="term in prediction.terms | unmatchedTermsOnly:prediction">{{term.value | trailingComma:!$last}}&nbsp;</span>',
            '<span class="custom-prediction-label" ng-if="prediction.is_custom">&nbsp;<span ng-bind="prediction.custom_prediction_label"></span></span>'
        ];

        return {
            restrict: 'A',
            scope: {
                index: '=',
                prediction: '=',
                query: '='
            },
            template: TEMPLATE.join('')
        };
    }

    function highlightMatched($sce) {
        return function (prediction) {
            var matchedPortion = '',
                unmatchedPortion = '',
                matched;

            if (prediction.matched_substrings.length > 0 &&
                prediction.terms.length > 0) {
                matched = prediction.matched_substrings[0];
                matchedPortion =
                    prediction.terms[0].value.substr(matched.offset,
                        matched.length);
                unmatchedPortion =
                    prediction.terms[0].value.substr(matched.offset +
                        matched.length);
            }

            return $sce.trustAsHtml('<span class="pac-matched">' +
                matchedPortion + '</span>' + unmatchedPortion);
        };
    }

    function unmatchedTermsOnly() {
        return function (terms, prediction) {
            var i, term, filtered = [];

            for (i = 0; i < terms.length; i++) {
                term = terms[i];
                if (prediction.matched_substrings.length > 0 &&
                        term.offset > prediction.matched_substrings[0].length) {
                    filtered.push(term);
                }
            }

            return filtered;
        };
    }

    function trailingComma() {
        return function (input, condition) {
            if (condition) {
                return input + ',';
            }
            return input;
        };
    }


    googlePlacesApi.$inject = ['$window'];
    gPlacesAutocomplete.$inject = ['$compile', '$document', 'googlePlacesApi'];
    gPlacesAutocompleteDrawer.$inject = [
        '$window', '$document', '$injector', '$timeout'
    ];
    highlightMatched.$inject = ['$sce'];

    module.directive('gPlacesAutocomplete', gPlacesAutocomplete);
    module.directive('gPlacesAutocompleteDrawer', gPlacesAutocompleteDrawer);
    module.directive('gPlacesAutocompletePrediction', gPlacesAutocompletePrediction);
    module.factory('googlePlacesApi', googlePlacesApi);
    module.filter('highlightMatched', highlightMatched);
    module.filter('unmatchedTermsOnly', unmatchedTermsOnly);
    module.filter('trailingComma', trailingComma);
}());
