/**
 * Copyright (c) 2016-2017 Guyon Roche
 * LICENCE: MIT - please refer to LICENCE file included with this module
 * or https://github.com/guyonroche/exceljs/blob/master/LICENSE
 */

'use strict';

var utils = require('../../../utils/utils');
var colCache = require('../../../utils/col-cache');
var BaseXform = require('../base-xform');
var StaticXform = require('../static-xform');

var CellPositionXform = require('./cell-position-xform');
var PicXform = require('./pic-xform');

var TwoCellAnchorXform = module.exports = function() {
  this.map = {
    'xdr:from': new CellPositionXform({tag: 'xdr:from'}),
    'xdr:to': new CellPositionXform({tag: 'xdr:to'}),
    'xdr:pic': new PicXform(),
    'xdr:clientData': new StaticXform({tag: 'xdr:clientData'}),
  };
};

utils.inherits(TwoCellAnchorXform, BaseXform, {
  get tag() { return 'xdr:twoCellAnchor'; },

  prepare: function(model, options) {
    this.map['xdr:pic'].prepare(model.picture, options);

    // convert model.range into tl, br
    if (typeof model.range === 'string') {
      var range = colCache.decode(model.range);
      // Note - zero based
      model.tl = {
        col: range.left - 1,
        row: range.top - 1,
      };
      // zero based but also +1 to cover to bottom right of br cell
      model.br = {
        col: range.right,
        row: range.bottom
      };
    } else {
      model.tl = model.range.tl;
      model.br = model.range.br;
    }
  },

  render: function(xmlStream, model) {
    xmlStream.openNode(this.tag);

    this.map['xdr:from'].render(xmlStream, model.tl);
    this.map['xdr:to'].render(xmlStream, model.br);
    this.map['xdr:pic'].render(xmlStream, model.picture);
    this.map['xdr:clientData'].render(xmlStream, {});

    xmlStream.closeNode();
  },

  parseOpen: function(node) {
    if (this.parser) {
      this.parser.parseOpen(node);
      return true;
    }
    switch (node.name) {
      case this.tag:
        this.reset();
        break;
      default:
        this.parser = this.map[node.name];
        if (this.parser) {
          this.parser.parseOpen(node);
        }
        break;
    }
    return true;
  },

  parseText: function(text) {
    if (this.parser) {
      this.parser.parseText(text);
    }
  },

  parseClose: function(name) {
    if (this.parser) {
      if (!this.parser.parseClose(name)) {
        this.parser = undefined;
      }
      return true;
    }
    switch (name) {
      case this.tag:
        this.model = {
          tl: this.map['xdr:from'].model,
          br: this.map['xdr:to'].model,
          picture: this.map['xdr:pic'].model,
        };
        return false;
      default:
        // could be some unrecognised tags
        return true;
    }
  },

  reconcile: function(model, options) {
    var rel = options.rels[model.picture.rId];
    var match = rel.Target.match(/.*\/media\/(.+[.][a-z]{3,4})/);
    if (match) {
      var name = match[1];
      var mediaId = options.mediaIndex[name];
      model.medium = options.media[mediaId];
    }
    if (Number.isInteger(model.tl.row) && Number.isInteger(model.tl.col) && Number.isInteger(model.br.row) && Number.isInteger(model.br.col)) {
      model.range = colCache.encode(model.tl.row + 1, model.tl.col + 1, model.br.row, model.br.col);
    } else {
      model.range = {
        tl: model.tl,
        br: model.br,
      };
    }
    delete model.tl;
    delete model.br;
  }
});
