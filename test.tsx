import { Decimal } from 'decimal.js'

import {
    validateAmountDecimals,
    decimalAmountToString,
    stringAmountToDecimal,
    parseAmountFromString,
    convertSecretValueToPublicValue,
    deserializeWebcash,
    createWebcashWithRandomSecretFromAmount,
    PublicWebcash,
    SecretWebcash,
    WebcashWallet,
    generateRandomValue,
    hexToBytes,
    hexToPaddedBytes,
    paddedBytes,
    longToByteArray,
    chunkArray,
    range,
} from './src'

test("range", () => {
    expect(range(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(range(5, 10)).toEqual([5, 6, 7, 8, 9]);
});

test("chunkArray", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 1)).toEqual([[1], [2], [3], [4], [5]]);
    expect(chunkArray([1, 2, 3, 4, 5, 6], 3)).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(chunkArray([1, 2, 3, 4, 5, 6], 5)).toEqual([[1, 2, 3, 4, 5], [6]]);
});

test("test function for validating amount has at most 8 decimal places", () => {
    expect(validateAmountDecimals("1")).toBe(true);
    expect(validateAmountDecimals("1.0")).toBe(true);
    expect(validateAmountDecimals("1.00")).toBe(true);
    expect(validateAmountDecimals("1.000")).toBe(true);
    expect(validateAmountDecimals("1.0000")).toBe(true);
    expect(validateAmountDecimals("1.00000")).toBe(true);
    expect(validateAmountDecimals("1.000000")).toBe(true);
    expect(validateAmountDecimals("1.0000000")).toBe(true);
    expect(validateAmountDecimals("1.00000000")).toBe(true);

    // is this unexpected behavior?
    expect(validateAmountDecimals("1.000000000000000000")).toBe(true);

    expect(validateAmountDecimals("100000000")).toBe(true);
    expect(validateAmountDecimals("100000000.0")).toBe(true);
    expect(validateAmountDecimals("100000000.00")).toBe(true);
    expect(validateAmountDecimals("100000000.000")).toBe(true);
    expect(validateAmountDecimals("100000000.0000")).toBe(true);
    expect(validateAmountDecimals("100000000.00000")).toBe(true);
    expect(validateAmountDecimals("100000000.000000")).toBe(true);
    expect(validateAmountDecimals("100000000.0000000")).toBe(true);
    expect(validateAmountDecimals("100000000.00000000")).toBe(true);

    expect(() => validateAmountDecimals("1.000000001")).toThrow(RangeError);
    expect(() => validateAmountDecimals("1.0000000001")).toThrow(RangeError);
    expect(() => validateAmountDecimals("1.000000000000999999999")).toThrow(RangeError);
});

test("convert decimal amount to string", () => {
    expect(decimalAmountToString(new Decimal("1.0"))).toBe("1");
    expect(decimalAmountToString(new Decimal("1.099"))).toBe("1.099");
});

test("string amount to decimal", () => {
    expect(stringAmountToDecimal("1")).toEqual(new Decimal(1));
});

test("parse amount from string", () => {
    expect(parseAmountFromString("e1")).toEqual(new Decimal(1));
    expect(parseAmountFromString("e500")).toEqual(new Decimal(500));
    expect(parseAmountFromString("e1.05")).toEqual(new Decimal("1.05"));

    expect(parseAmountFromString("100:secret:feedbeef")).toEqual(new Decimal(100));
    expect(parseAmountFromString("e100:secret:feedbeef")).toEqual(new Decimal(100));

    expect(() => parseAmountFromString("e500e")).toThrow(Error);
    expect(() => parseAmountFromString("e500.00e")).toThrow(Error);
    expect(() => parseAmountFromString("e100.00e")).toThrow(Error);
    expect(() => parseAmountFromString("ee100")).toThrow(Error);
});

test("deserialize webcash", () => {
    expect(deserializeWebcash("e100:secret:feedbeef").secret_value).toBe("feedbeef");
    expect(deserializeWebcash("e1:secret:feedbeef").secret_value).toBe("feedbeef");
    expect(deserializeWebcash("1:secret:feedbeef").secret_value).toBe("feedbeef");

    expect(deserializeWebcash("e1:secret:feedbeef").amount).toEqual(new Decimal(1));
    expect(deserializeWebcash("e100:secret:feedbeef").amount).toEqual(new Decimal(100));

    expect(deserializeWebcash("e1:public:feedbeef").hashed_value).toBe("feedbeef");
    expect(deserializeWebcash("e100:public:feedbeef").hashed_value).toBe("feedbeef");

    expect(deserializeWebcash("e1:public:feedbeef").amount).toEqual(new Decimal(1));
    expect(deserializeWebcash("e100:public:feedbeef").amount).toEqual(new Decimal(100));
});

// Careful when using createWebcashWithRandomSecretFromAmount, it doesn't use
// the deterministic wallet.
test("create random new webcash from amount", () => {
    let webcash_str = createWebcashWithRandomSecretFromAmount(new Decimal(100));
    expect(webcash_str).toMatch(/:/);

    let webcash = deserializeWebcash(webcash_str);
    expect(webcash.amount).toEqual(new Decimal(100));
});

test("converting from secret to public values", () => {
    expect(convertSecretValueToPublicValue("feedbeef"))
        .toEqual("32549bff6d8404c4d121b589f4d24ac6416ed48c25163e1f08d92d67ca0bb0b3");
});

test("secret and public webcash", () => {
    new SecretWebcash(new Decimal(1), "feedbeef");
    new PublicWebcash(new Decimal(1), "feedbeef");

    let swc = new SecretWebcash(new Decimal(1), "feedbeef");
    expect(swc.amount).toEqual(new Decimal(1));
    expect(swc.toPublic().amount).toEqual(new Decimal(1));
    expect(swc.toPublic().hashed_value).toEqual("32549bff6d8404c4d121b589f4d24ac6416ed48c25163e1f08d92d67ca0bb0b3");
    expect(swc.toPublic().amount).toEqual(swc.amount);
});

test("public webcash deserializer", () => {
    expect(PublicWebcash.deserialize("e100:public:feedbeef").amount).toEqual(new Decimal(100));
    expect(PublicWebcash.deserialize("e15.05:public:feedbeef")).toEqual(new PublicWebcash(new Decimal("15.05"), "feedbeef"));
});

test("secret webcash deserializer", () => {
    expect(SecretWebcash.deserialize("e100:secret:feedbeef").amount).toEqual(new Decimal(100));
    expect(SecretWebcash.deserialize("e3.003:secret:feedbeef")).toEqual(new SecretWebcash(new Decimal("3.003"), "feedbeef"));
});

test("public webcash toString", () => {
    expect((new PublicWebcash(new Decimal(1), "feedbeef")).toString()).toEqual("e1:public:feedbeef");
});

test("secret webcash toString", () => {
    expect((new SecretWebcash(new Decimal(1), "feedbeef")).toString()).toEqual("e1:secret:feedbeef");
});

test("webcash wallet constructor", () => {
    new WebcashWallet();
});

test("generate random value", () => {
    expect(generateRandomValue(32)).not.toEqual(generateRandomValue(32));
});

test("hex and bytes", () => {
    expect(hexToPaddedBytes("0xfeedbeef")).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xfe, 0xed, 0xbe, 0xef]);
});

test("paddedBytes", () => {
    expect(paddedBytes([0], 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(paddedBytes([1], 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
});

test("longToByteArray", () => {
    expect(longToByteArray(1).reverse()).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(longToByteArray(1234).reverse()).toEqual([0, 0, 0, 0, 0, 0, 4, 210]);
    expect(longToByteArray(100000000).reverse()).toEqual([0, 0, 0, 0, 5, 245, 225, 0]);
});

test("generate next secret", () => {
    let wallet = new WebcashWallet({"master_secret": "6fc3d1b067646ea749e4001e05c757c491b351424ae998339d6341d7a18e12d4"});
    let next_secret = wallet.generateNextSecret("RECEIVE", 0);
    expect(next_secret).toEqual("29a24ce26ec924e20a68773d6909b91855b4a39a4224bde1e33eb52e29fc7a70");

    next_secret = wallet.generateNextSecret("RECEIVE", 1);
    expect(next_secret).toEqual("42755e0fe6fd0bdf8ac998044628435ac46f7e630cf37d49cfe0080fae29de53");

    // try another chaincode
    next_secret = wallet.generateNextSecret("PAY", 0);
    expect(next_secret).toEqual("b16095ea71f638b3a5651bffa5255a608a3cd535050f4828c1585b684ee529c7");
    next_secret = wallet.generateNextSecret("PAY", 1);
    expect(next_secret).toEqual("d2ea5643e0d92397744beb56e0b0995f57f55017b71df82f6956fc047a0fdc2f");

    next_secret = wallet.generateNextSecret("RECEIVE", 100);
    expect(next_secret).toEqual("b8cd5030dd4a48be10449aa6bb2e666db50bfe0afd63e9ac79747174ca49719b");

    next_secret = wallet.generateNextSecret("RECEIVE", 1234);
    expect(next_secret).toEqual("cc6d5193b96297bc802827d6a4a90a063d6acfa78c772bcb5154c986dd2f6872");

    next_secret = wallet.generateNextSecret("RECEIVE", 100000000);
    expect(next_secret).toEqual("8c7fa87d19121f17c523159ce03fc7ec5bbd4ca4bbb63caefa49d8e9db40b845");
});

test("wallet insert and pay (live)", async () => {
    let wallet = new WebcashWallet({"master_secret": "6fc3d1b067646ea749e4001e05c757c491b351424ae998339d6341d7a18e12d4"});
    wallet.setLegalAgreementsToTrue()

    //let result = await wallet.insert("e2:secret:ea443eb12881745b2793ed245cd006ade7814ffca46dc49d79dace0f41552b58");
    //expect(wallet.getBalance()).toEqual(new Decimal(2));

    //wallet.walletdepths["RECEIVE"] = 1
    //let result = await wallet.insert("e10:secret:33aae345c6808f4a4a83b6b9d92a92b50382bedef401f031066c20c3642319a7");
    //expect(wallet.getBalance()).toEqual(new Decimal(10));

    ////wallet.webcash.push("e2:secret:29a24ce26ec924e20a68773d6909b91855b4a39a4224bde1e33eb52e29fc7a70")
    //wallet.webcash.push("e10:secret:42755e0fe6fd0bdf8ac998044628435ac46f7e630cf37d49cfe0080fae29de53")
    ////expect(wallet.getBalance()).toEqual(new Decimal(12));
    //expect(wallet.getBalance()).toEqual(new Decimal(10));
    wallet.walletdepths["RECEIVE"] = 2;

    // now try a too-big payment
    await expect(wallet.pay(200)).rejects.toThrow(Error);

    // ok try a payment for real
    //await expect(wallet.pay(2)).resolves.toEqual("e2:secret:b16095ea71f638b3a5651bffa5255a608a3cd535050f4828c1585b684ee529c7")
    //expect(wallet.getBalance()).toEqual(new Decimal(10));

    // try another too-big payment
    await expect(wallet.pay(12)).rejects.toThrow(Error);
    wallet.walletdepths["PAY"] = 1;

    //// add the payment back into the wallet
    //wallet.webcash.push("e2:secret:b16095ea71f638b3a5651bffa5255a608a3cd535050f4828c1585b684ee529c7");
    //expect(wallet.getBalance()).toEqual(new Decimal(12));

    //await expect(wallet.pay(12)).resolves.toEqual("e12:secret:d2ea5643e0d92397744beb56e0b0995f57f55017b71df82f6956fc047a0fdc2f");
    //expect(wallet.getBalance()).toEqual(new Decimal(0));
    //expect(wallet.walletdepths["PAY"]).toEqual(2);
    wallet.walletdepths["PAY"] = 2;

    //// add payment back into the wallet
    //wallet.webcash.push("e12:secret:d2ea5643e0d92397744beb56e0b0995f57f55017b71df82f6956fc047a0fdc2f");
    //wallet.webcash.push("e3:secret:451bbbe9e76b355710369180ebd6c295e851391df8bc6484167b32d7ce742834");
    //expect(wallet.getBalance()).toEqual(new Decimal(15));

    //// send a multi-output payment
    //await expect(wallet.pay(15)).resolves.toEqual("e15:secret:097750ead325ea39437bfb561e8886d8310443f9cf8a9287b8f57db98aefa687");
    //expect(wallet.getBalance()).toEqual(new Decimal(0));
    //expect(wallet.walletdepths["PAY"]).toEqual(3);
});

test("check webcash in wallet", async () => {
    let wallet = new WebcashWallet({"master_secret": "6fc3d1b067646ea749e4001e05c757c491b351424ae998339d6341d7a18e12d4"});
    wallet.setLegalAgreementsToTrue();

    wallet.webcash.push("e15:secret:13c62ea73d555409a880cadc6270f896bf1e429d4776a2251cd13f6fd76b1b15");
    wallet.webcash.push("e6:secret:218f09ba86bfe622f52950dbbe3f0d9c7c464f1705039b476d2408d407d08cea");
    wallet.webcash.push("e6:secret:218f09ba86bfe622f52950dbbe3f0d9c7c464f1705039b476d2408d407d08cea");

    // total balance should be 27
    expect(wallet.getBalance()).toEqual(new Decimal(27));

    // works
    /*
    // check should remove the duplicate
    await wallet.check();
    expect(wallet.getBalance()).toEqual(new Decimal(21));

    // add an invalid webcash
    wallet.webcash.push("e200:secret:foobar");
    expect(wallet.getBalance()).toEqual(new Decimal(221));
    //const something = await wallet.check();
    await expect(wallet.check()).resolves.not.toEqual(Error);
    //await Promise.resolve();
    expect(wallet.getBalance()).toEqual(new Decimal(21));
    */
});

test("processHealthcheckResults", () => {
    let wallet = new WebcashWallet({"master_secret": "6fc3d1b067646ea749e4001e05c757c491b351424ae998339d6341d7a18e12d4"});
    wallet.setLegalAgreementsToTrue();
    wallet.webcash.push("e15:secret:13c62ea73d555409a880cadc6270f896bf1e429d4776a2251cd13f6fd76b1b15");
    wallet.webcash.push("e6:secret:218f09ba86bfe622f52950dbbe3f0d9c7c464f1705039b476d2408d407d08cea");
    expect(wallet.getBalance()).toEqual(new Decimal(21));

    let webcashesMap = {
        "155191994c768836d5447b6e7897e27192829ec6ec8b725495a68b48c69e4236": "e15:secret:13c62ea73d555409a880cadc6270f896bf1e429d4776a2251cd13f6fd76b1b15",
        "760779899e2386bc3b164aa3f56e4dea4d11bd95d4e5f755cb53da9c72c72bfe": "e6:secret:218f09ba86bfe622f52950dbbe3f0d9c7c464f1705039b476d2408d407d08cea",
    };

    // make up a scenario where the server says the amount is different
    let results = {
        //"e15:public:155191994c768836d5447b6e7897e27192829ec6ec8b725495a68b48c69e4236": {"spent": false, "amount": "15"},
        "e20:public:155191994c768836d5447b6e7897e27192829ec6ec8b725495a68b48c69e4236": {"spent": false, "amount": "20"},
        "e6:public:760779899e2386bc3b164aa3f56e4dea4d11bd95d4e5f755cb53da9c72c72bfe": {"spent": false, "amount": "6"},
    };

    wallet.processHealthcheckResults(results, webcashesMap);

    // wallet should have been updated for the new balance
    expect(wallet.getBalance()).toEqual(new Decimal(26));

    // let's test it again, this time the amount error is in the wallet
    let wallet2 = new WebcashWallet({"master_secret": "6fc3d1b067646ea749e4001e05c757c491b351424ae998339d6341d7a18e12d4"});
    wallet2.setLegalAgreementsToTrue();
    wallet2.webcash.push("e20:secret:13c62ea73d555409a880cadc6270f896bf1e429d4776a2251cd13f6fd76b1b15");
    wallet2.webcash.push("e6:secret:218f09ba86bfe622f52950dbbe3f0d9c7c464f1705039b476d2408d407d08cea");

    let webcashesMap2 = {
        "155191994c768836d5447b6e7897e27192829ec6ec8b725495a68b48c69e4236": "e20:secret:13c62ea73d555409a880cadc6270f896bf1e429d4776a2251cd13f6fd76b1b15",
        "760779899e2386bc3b164aa3f56e4dea4d11bd95d4e5f755cb53da9c72c72bfe": "e6:secret:218f09ba86bfe622f52950dbbe3f0d9c7c464f1705039b476d2408d407d08cea",
    };

    let results2 = {
        "e15:public:155191994c768836d5447b6e7897e27192829ec6ec8b725495a68b48c69e4236": {"spent": false, "amount": "15"},
        "e6:public:760779899e2386bc3b164aa3f56e4dea4d11bd95d4e5f755cb53da9c72c72bfe": {"spent": false, "amount": "6"},
    };

    wallet2.processHealthcheckResults(results2, webcashesMap2);
    expect(wallet2.getBalance()).toEqual(new Decimal(21));

    // now try removal
    let webcashesMap3 = {
        "155191994c768836d5447b6e7897e27192829ec6ec8b725495a68b48c69e4236": "e15:secret:13c62ea73d555409a880cadc6270f896bf1e429d4776a2251cd13f6fd76b1b15",
        "760779899e2386bc3b164aa3f56e4dea4d11bd95d4e5f755cb53da9c72c72bfe": "e6:secret:218f09ba86bfe622f52950dbbe3f0d9c7c464f1705039b476d2408d407d08cea",
    }
    let results3 = {
        "e15:public:155191994c768836d5447b6e7897e27192829ec6ec8b725495a68b48c69e4236": {"spent": true, "amount": "15"},
        "e6:public:760779899e2386bc3b164aa3f56e4dea4d11bd95d4e5f755cb53da9c72c72bfe": {"spent": false, "amount": "6"},
    };
    wallet2.processHealthcheckResults(results3, webcashesMap3);
    expect(wallet2.getBalance()).toEqual(new Decimal(6));
});

test("wallet recovery", async () => {
    //jest.setTimeout(20000) // doesn't seem to change the timeout?

    let wallet = new WebcashWallet({"master_secret": "6fc3d1b067646ea749e4001e05c757c491b351424ae998339d6341d7a18e12d4"});
    wallet.setLegalAgreementsToTrue();
    expect(wallet.getBalance()).toEqual(new Decimal(0));

    // works
    /*await wallet.recover();
    await Promise.resolve();
    expect(wallet.getBalance()).toEqual(new Decimal(10));*/
});
