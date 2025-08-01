/*!
 * Generated using the Bootstrap Customizer (<none>)
 * Config saved to config.json and <none>
 */
if ('undefined' == typeof jQuery)
  throw new Error("Bootstrap's JavaScript requires jQuery");
(+(function (t) {
  'use strict';
  var e = t.fn.jquery.split(' ')[0].split('.');
  if (
    (e[0] < 2 && e[1] < 9) ||
    (1 == e[0] && 9 == e[1] && e[2] < 1) ||
    e[0] > 3
  )
    throw new Error(
      "Bootstrap's JavaScript requires jQuery version 1.9.1 or higher, but lower than version 4"
    );
})(jQuery),
  +(function (t) {
    'use strict';
    function e(e) {
      var n,
        i =
          e.attr('data-target') ||
          ((n = e.attr('href')) && n.replace(/.*(?=#[^\s]+$)/, ''));
      return t(i);
    }
    function n(e) {
      return this.each(function () {
        var n = t(this),
          s = n.data('bs.collapse'),
          a = t.extend({}, i.DEFAULTS, n.data(), 'object' == typeof e && e);
        (!s && a.toggle && /show|hide/.test(e) && (a.toggle = !1),
          s || n.data('bs.collapse', (s = new i(this, a))),
          'string' == typeof e && s[e]());
      });
    }
    var i = function (e, n) {
      ((this.$element = t(e)),
        (this.options = t.extend({}, i.DEFAULTS, n)),
        (this.$trigger = t(
          '[data-toggle="collapse"][href="#' +
            e.id +
            '"],[data-toggle="collapse"][data-target="#' +
            e.id +
            '"]'
        )),
        (this.transitioning = null),
        this.options.parent
          ? (this.$parent = this.getParent())
          : this.addAriaAndCollapsedClass(this.$element, this.$trigger),
        this.options.toggle && this.toggle());
    };
    ((i.VERSION = '3.3.7'),
      (i.TRANSITION_DURATION = 350),
      (i.DEFAULTS = { toggle: !0 }),
      (i.prototype.dimension = function () {
        var t = this.$element.hasClass('width');
        return t ? 'width' : 'height';
      }),
      (i.prototype.show = function () {
        if (!this.transitioning && !this.$element.hasClass('in')) {
          var e,
            s =
              this.$parent &&
              this.$parent.children('.panel').children('.in, .collapsing');
          if (
            !(
              s &&
              s.length &&
              ((e = s.data('bs.collapse')), e && e.transitioning)
            )
          ) {
            var a = t.Event('show.bs.collapse');
            if ((this.$element.trigger(a), !a.isDefaultPrevented())) {
              s &&
                s.length &&
                (n.call(s, 'hide'), e || s.data('bs.collapse', null));
              var r = this.dimension();
              (this.$element
                .removeClass('collapse')
                .addClass('collapsing')
                [r](0)
                .attr('aria-expanded', !0),
                this.$trigger
                  .removeClass('collapsed')
                  .attr('aria-expanded', !0),
                (this.transitioning = 1));
              var o = function () {
                (this.$element
                  .removeClass('collapsing')
                  .addClass('collapse in')
                  [r](''),
                  (this.transitioning = 0),
                  this.$element.trigger('shown.bs.collapse'));
              };
              if (!t.support.transition) return o.call(this);
              var l = t.camelCase(['scroll', r].join('-'));
              this.$element
                .one('bsTransitionEnd', t.proxy(o, this))
                .emulateTransitionEnd(i.TRANSITION_DURATION)
                [r](this.$element[0][l]);
            }
          }
        }
      }),
      (i.prototype.hide = function () {
        if (!this.transitioning && this.$element.hasClass('in')) {
          var e = t.Event('hide.bs.collapse');
          if ((this.$element.trigger(e), !e.isDefaultPrevented())) {
            var n = this.dimension();
            (this.$element[n](this.$element[n]())[0].offsetHeight,
              this.$element
                .addClass('collapsing')
                .removeClass('collapse in')
                .attr('aria-expanded', !1),
              this.$trigger.addClass('collapsed').attr('aria-expanded', !1),
              (this.transitioning = 1));
            var s = function () {
              ((this.transitioning = 0),
                this.$element
                  .removeClass('collapsing')
                  .addClass('collapse')
                  .trigger('hidden.bs.collapse'));
            };
            return t.support.transition
              ? void this.$element[n](0)
                  .one('bsTransitionEnd', t.proxy(s, this))
                  .emulateTransitionEnd(i.TRANSITION_DURATION)
              : s.call(this);
          }
        }
      }),
      (i.prototype.toggle = function () {
        this[this.$element.hasClass('in') ? 'hide' : 'show']();
      }),
      (i.prototype.getParent = function () {
        return t(this.options.parent)
          .find(
            '[data-toggle="collapse"][data-parent="' +
              this.options.parent +
              '"]'
          )
          .each(
            t.proxy(function (n, i) {
              var s = t(i);
              this.addAriaAndCollapsedClass(e(s), s);
            }, this)
          )
          .end();
      }),
      (i.prototype.addAriaAndCollapsedClass = function (t, e) {
        var n = t.hasClass('in');
        (t.attr('aria-expanded', n),
          e.toggleClass('collapsed', !n).attr('aria-expanded', n));
      }));
    var s = t.fn.collapse;
    ((t.fn.collapse = n),
      (t.fn.collapse.Constructor = i),
      (t.fn.collapse.noConflict = function () {
        return ((t.fn.collapse = s), this);
      }),
      t(document).on(
        'click.bs.collapse.data-api',
        '[data-toggle="collapse"]',
        function (i) {
          var s = t(this);
          s.attr('data-target') || i.preventDefault();
          var a = e(s),
            r = a.data('bs.collapse'),
            o = r ? 'toggle' : s.data();
          n.call(a, o);
        }
      ));
  })(jQuery),
  +(function (t) {
    'use strict';
    function e() {
      var t = document.createElement('bootstrap'),
        e = {
          WebkitTransition: 'webkitTransitionEnd',
          MozTransition: 'transitionend',
          OTransition: 'oTransitionEnd otransitionend',
          transition: 'transitionend',
        };
      for (var n in e) if (void 0 !== t.style[n]) return { end: e[n] };
      return !1;
    }
    ((t.fn.emulateTransitionEnd = function (e) {
      var n = !1,
        i = this;
      t(this).one('bsTransitionEnd', function () {
        n = !0;
      });
      var s = function () {
        n || t(i).trigger(t.support.transition.end);
      };
      return (setTimeout(s, e), this);
    }),
      t(function () {
        ((t.support.transition = e()),
          t.support.transition &&
            (t.event.special.bsTransitionEnd = {
              bindType: t.support.transition.end,
              delegateType: t.support.transition.end,
              handle: function (e) {
                return t(e.target).is(this)
                  ? e.handleObj.handler.apply(this, arguments)
                  : void 0;
              },
            }));
      }));
  })(jQuery));

(function ($) {
  'use strict';

  // ------------------------------------------------------------------------------ //
  // get path relative to javascript
  // ------------------------------------------------------------------------------ //

  // Sidebar

  $(document).ready(function () {
    $('.close-btn').on('click', function () {
      $('.navsidebar').removeClass('active');
    });

    $('#navsidebarCollapse').on('click', function () {
      $('.nav-sidebar').addClass('active');
      $('.collapse.in').toggleClass('in');
      $('a[aria-expanded=true]').attr('aria-expanded', 'false');
    });
  });
});

window.slide = new SlideNav({
  changeHash: true,
});

function w3_open() {
  document.getElementsByClassName('side-nav')[0].style.display = 'block';
}
function w3_close() {
  document.getElementsByClassName('side-nav')[0].style.display = 'none';
}

jQuery;
