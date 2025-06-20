"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boolean = exports.stringLayout = exports.uint128 = exports.uint64 = exports.pubKey = void 0;
const buffer_layout_1 = require("@solana/buffer-layout");
const web3_js_1 = require("@solana/web3.js");
const pubKey = (property) => {
    const layout = (0, buffer_layout_1.blob)(32, property);
    const pubKeyLayout = layout;
    const decode = layout.decode.bind(layout);
    pubKeyLayout.decode = (buffer, offset) => {
        const src = decode(buffer, offset);
        return new web3_js_1.PublicKey(src);
    };
    return pubKeyLayout;
};
exports.pubKey = pubKey;
const uint64 = (property) => {
    const layout = (0, buffer_layout_1.blob)(8, property);
    const uint64Layout = layout;
    const decode = layout.decode.bind(layout);
    uint64Layout.decode = (buffer, offset) => {
        const src = decode(buffer, offset);
        return Buffer.from(src).readBigUInt64LE();
    };
    return uint64Layout;
};
exports.uint64 = uint64;
const uint128 = (property) => {
    const layout = (0, buffer_layout_1.blob)(16, property);
    const uint128Layout = layout;
    const decode = layout.decode.bind(layout);
    uint128Layout.decode = (buffer, offset) => {
        const src = decode(buffer, offset);
        return Buffer.from(src).readBigUInt64LE();
    };
    return uint128Layout;
};
exports.uint128 = uint128;
const stringLayout = (property) => {
    const layout = (0, buffer_layout_1.blob)(4, property);
    const stringLayout = layout;
    stringLayout.decode = (buffer, offset) => {
        const length = buffer.readUInt32LE(offset);
        return buffer.slice(offset + 4, offset + 4 + length).toString('utf-8');
    };
    stringLayout.getSpan = (buffer, offset) => {
        const length = buffer.readUInt32LE(offset);
        return 4 + length;
    };
    return stringLayout;
};
exports.stringLayout = stringLayout;
const boolean = (property) => {
    const layout = (0, buffer_layout_1.blob)(1, property);
    const booleanLayout = layout;
    const decode = layout.decode.bind(layout);
    booleanLayout.decode = (buffer, offset) => {
        const src = decode(buffer, offset);
        return src[0] === 1;
    };
    return booleanLayout;
};
exports.boolean = boolean;
//# sourceMappingURL=layout.js.map