/*
MIT License

Copyright (c) 2020 Anurag Hazra

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// @ts-check
// process.env.NODE_ENV = "dev";

/**
 * Encode string as HTML.
 *
 * @see https://stackoverflow.com/a/48073476/10629172
 *
 * @param {string} str String to encode.
 * @returns {string} Encoded string.
 */
const encodeHTML = (str) => {
  return str
    .replace(/[\u00A0-\u9999<>&](?!#)/gim, (i) => {
      return "&#" + i.charCodeAt(0) + ";";
    })
    .replace(/\u0008/gim, "");
};

/**
 * Auto layout utility, allows us to layout things vertically or horizontally with
 * proper gaping.
 *
 * @param {object} props Function properties.
 * @param {string[]} props.items Array of items to layout.
 * @param {number} props.gap Gap between items.
 * @param {"column" | "row"=} props.direction Direction to layout items.
 * @param {number[]=} props.sizes Array of sizes for each item.
 * @returns {string[]} Array of items with proper layout.
 */
const flexLayout = ({ items, gap, direction, sizes = [] }) => {
  let lastSize = 0;
  // filter() for filtering out empty strings
  return items.filter(Boolean).map((item, i) => {
    const size = sizes[i] || 0;
    let transform = `translate(${lastSize}, 0)`;
    if (direction === "column") {
      transform = `translate(0, ${lastSize})`;
    }
    lastSize += size + gap;
    return `<g transform="${transform}">${item}</g>`;
  });
};

class Card {
  /**
   * Creates a new card instance.
   *
   * @param {object} args Card arguments.
      * @param {number=} args.width           Card width.
      * @param {number=} args.height          Card height.
      * @param {number=} args.border_radius   Card border radius.
      * @param {string=} args.customTitle     Card custom title.
      * @param {string=} args.defaultTitle    Card default title.
      * @param {string=} args.titlePrefixIcon Card title prefix icon.
      * @param {object}  [args.colors={}]     Card colors arguments.
          * @param {string=}          args.colors.titleColor  Card title color.
          * @param {string=}          args.colors.textColor   Card text color.
          * @param {string=}          args.colors.iconColor   Card icon color.
          * @param {string|string[]=} args.colors.bgColor     Card background color.
          * @param {string=}          args.colors.borderColor Card border color.
   */
  constructor({
    width = 100,
    height = 100,
    border_radius = 4.5,
    colors = {},
    customTitle,
    defaultTitle = "",
    titlePrefixIcon,
  }) {
    this.width = width;
    this.height = height;

    this.hideBorder = false;
    this.hideTitle = false;

    this.border_radius = border_radius;

    // returns theme based colors with proper overrides and defaults
    this.colors = colors;
    this.title =
      customTitle === undefined
        ? encodeHTML(defaultTitle)
        : encodeHTML(customTitle);

    this.css = "";

    this.paddingX = 25;
    this.paddingY = 35;
    this.titlePrefixIcon = titlePrefixIcon;
    this.animations = true;
    this.a11yTitle = "";
    this.a11yDesc = "";
  }

  /**
   * @returns {void}
   */
  disableAnimations() {
    this.animations = false;
  }

  /**
   * @param {Object} props The props object.
   * @param {string} props.title Accessibility title.
   * @param {string} props.desc Accessibility description.
   * @returns {void}
   */
  setAccessibilityLabel({ title, desc }) {
    this.a11yTitle = title;
    this.a11yDesc = desc;
  }

  /**
   * @param {string} value The CSS to add to the card.
   * @returns {void}
   */
  setCSS(value) {
    this.css = value;
  }

  /**
   * @param {boolean} value Whether to hide the border or not.
   * @returns {void}
   */
  setHideBorder(value) {
    this.hideBorder = value;
  }

  /**
   * @param {boolean} value Whether to hide the title or not.
   * @returns {void}
   */
  setHideTitle(value) {
    this.hideTitle = value;
    if (value) {
      this.height -= 30;
    }
  }

  /**
   * @param {string} text The title to set.
   * @returns {void}
   */
  setTitle(text) {
    this.title = text;
  }

  /**
   * @returns {string} The rendered card title.
   */
  renderTitle() {
    const titleText = `
      <text
        x="0"
        y="0"
        class="header"
        data-testid="header"
      >${this.title}</text>
    `;

    const prefixIcon = `
      <svg
        class="icon"
        x="0"
        y="-13"
        viewBox="0 0 16 16"
        version="1.1"
        width="16"
        height="16"
      >
        ${this.titlePrefixIcon}
      </svg>
    `;
    return `
      <g
        data-testid="card-title"
        transform="translate(${this.paddingX}, ${this.paddingY})"
      >
        ${flexLayout({
          items: [this.titlePrefixIcon ? prefixIcon : "", titleText],
          gap: 25,
        }).join("")}
      </g>
    `;
  }

  /**
   * @returns {string} The rendered card gradient.
   */
  renderGradient() {
    if (typeof this.colors.bgColor !== "object") {
      return "";
    }

    const gradients = this.colors.bgColor.slice(1);
    return typeof this.colors.bgColor === "object"
      ? `
        <defs>
          <linearGradient
            id="gradient"
            gradientTransform="rotate(${this.colors.bgColor[0]})"
            gradientUnits="userSpaceOnUse"
          >
            ${gradients.map((grad, index) => {
              let offset = (index * 100) / (gradients.length - 1);
              return `<stop offset="${offset}%" stop-color="#${grad}" />`;
            })}
          </linearGradient>
        </defs>
        `
      : "";
  }

  /**
   * Retrieves css animations for a card.
   *
   * @returns {string} Animation css.
   */
  getAnimations = () => {
    return `
      /* Animations */
      @keyframes scaleInAnimation {
        from {
          transform: translate(-5px, 5px) scale(0);
        }
        to {
          transform: translate(-5px, 5px) scale(1);
        }
      }
      @keyframes fadeInAnimation {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `;
  };

  /**
   * @param {string} body The inner body of the card.
   * @returns {string} The rendered card.
   */
  render(body) {
    return `
      <svg
        width="${this.width}"
        height="${this.height}"
        viewBox="0 0 ${this.width} ${this.height}"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby="descId"
      >
        <title id="titleId">${this.a11yTitle}</title>
        <desc id="descId">${this.a11yDesc}</desc>
        <style>
          .header {
            font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif;
            fill: ${this.colors.titleColor};
            animation: fadeInAnimation 0.8s ease-in-out forwards;
          }
          @supports(-moz-appearance: auto) {
            /* Selector detects Firefox */
            .header { font-size: 15.5px; }
          }
          ${this.css}

          ${this.getAnimations()}
          ${
            this.animations === false
              ? `* { animation-duration: 0s !important; animation-delay: 0s !important; }`
              : ""
          }
        </style>

        ${this.renderGradient()}

        <rect
          data-testid="card-bg"
          x="0.5"
          y="0.5"
          rx="${this.border_radius}"
          height="99%"
          stroke="${this.colors.borderColor}"
          width="${this.width - 1}"
          fill="${
            typeof this.colors.bgColor === "object"
              ? "url(#gradient)"
              : this.colors.bgColor
          }"
          stroke-opacity="${this.hideBorder ? 0 : 1}"
        />

        ${this.hideTitle ? "" : this.renderTitle()}

        <g
          data-testid="main-card-body"
          transform="translate(0, ${
            this.hideTitle ? this.paddingX : this.paddingY + 20
          })"
        >
          ${body}
        </g>
      </svg>
    `;
  }
}

export { Card };