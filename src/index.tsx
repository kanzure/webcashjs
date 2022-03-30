import { Decimal } from 'decimal.js'
import fetch from 'cross-fetch'

// had a bunch of trouble with SHA256 from crypto-js
import SHA256 from 'crypto-js/sha256'
// .. ended up using one from ethereumjsUtil instead.
const createHash = require('create-hash')

import 'regenerator-runtime/runtime'

export function generateRandomValue(length: number) {
    return [...Array(length)]
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('')
}

export function assertIsArray(input: number[]): void {
  if (!Array.isArray(input)) {
    const msg = `This method only supports number arrays but input was: ${input}`
    throw new Error(msg)
  }
}

export function sha256FromArray(a: number[]): Uint8Array {
    assertIsArray(a)

    // aaaa this is a bad idea aaaa
    if (typeof window !== "undefined") {
        // probably a better way to do this..
        let b = a as unknown as Uint8Array

        return createHash("sha256")
            .update(b)
            .digest()
    } else {
        let b = Buffer.from(a as unknown as Uint8Array)
        return createHash("sha256")
            .update(b)
            .digest()
    }
}

export function chunkArray(array: Array<any>, chunkSize: number): Array<any> {
    var i, j, temporary
    var returnArray = []
    for (i = 0, j = array.length; i < j; i += chunkSize) {
        temporary = array.slice(i, i + chunkSize)
        returnArray.push(temporary)
    }
    return returnArray
}

export function range(start: number, stop: number, step: number = 1): Array<number> {
    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return []
    }

    var result = []
    for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i)
    }

    return result
}

/*function getDictionaryLength(someDict: any): number {
    const counter: number = 0
    for (var key in someDict) {
        if (someDict.hasOwnProperty(key)) {
            counter += 1
        }
    }
    return counter
}*/

const REPLACE_API = () => {
    const protocol = "https:"
    //    typeof window == "object" ? window.location.protocol : "https:"
    return `${protocol}//webcash.org/api/v1/replace`
}

const HEALTHCHECK_API = () => {
    const protocol = "https:"
    //    typeof window == "object" ? window.location.protocol : "https:"
    return `${protocol}//webcash.org/api/v1/health_check`
}

// deterministic wallets should not use this function
export function createWebcashWithRandomSecretFromAmount(amount: Decimal): string {
    return `e${amount.toString()}:secret:${generateRandomValue(32)}`
}

// Check that the amount has no more than a maximum number of decimal places.
export function validateAmountDecimals(amount: Decimal | string) {
    if (!(amount instanceof Decimal)) {
        amount = stringAmountToDecimal(amount)
    }

    if (amount.decimalPlaces() <= 8) {
        return true;
    } else {
        throw new RangeError("Amount precision should be at most 8 decimals.");
    }
}

// Convert a decimal amount to a string. This is used for representing
// different webcash when serializing webcash. When the amount is not known,
// the string should be "?".
export function decimalAmountToString(amount: Decimal) {
    if (amount == null) {
        return "?"
    } else {
        return amount.toString()
    }
}

// Convert from a string amount to a Decimal value.
export function stringAmountToDecimal(amount: string) {
    return new Decimal(amount)
}

export function parseAmountFromString(amount_raw: string): Decimal {
    // If there is a colon in the value, then the amount is going to be on the
    // left hand side.
    var amount = amount_raw.split(":")[0]
    if (amount[0] === 'e') {
        amount = amount.slice(1);
    }
    return new Decimal(amount);
}

// Take any kind of webcash and instantiate an object with the values specified
// by the serialized webcash.
export function deserializeWebcash(webcash: string): any {
    if (webcash.includes(":")) {
        const parts = webcash.split(":")
        if (parts.length < 2) {
            throw new Error("Don't know how to deserialize this webcash.")
        }

        const amount_raw = parts[0]
        const public_or_secret = parts[1]
        const value = parts[2]

        if (!["public", "secret"].includes(public_or_secret)) {
            throw new Error("Can't deserialize this webcash, needs to be either public/secret.")
        }

        const amount = parseAmountFromString(amount_raw)

        if (public_or_secret == "secret") {
            return new SecretWebcash(amount, value)
        } else if (public_or_secret == "public") {
            return new PublicWebcash(amount, value)
        } else {
            throw new Error("Don't know how to deserialize this webcash.")
        }
    } else {
        throw new Error("Unusable format for webcash.")
    }
}

export function convertSecretValueToPublicValue(secret_value: string): string {
    const publicvalue = SHA256(secret_value)
    return `${publicvalue}`
}

export function hexToBytes(hex: string) {
    // TODO: verify that hex is really a hex string
    hex = hex.replace(/^0x/i, '')
    for (var bytes = [], c = 0; c < hex.length; c += 2) {
        bytes.push(parseInt(hex.substr(c, 2), 16))
    }
    return bytes
}

// Not sure this really works... see longToByteArray instead.
export function paddedBytes(bytes: number[], paddingTargetLength: number = 32) {
    if (bytes.length == paddingTargetLength) {
        return bytes
    } else if (bytes.length > paddingTargetLength) {
        throw new Error(`Can only handle up to ${paddingTargetLength} bytes, int too big to convert`)
    } else {
        const returnValue = []

        for (var x = 0; x < bytes.length; x += 1) {
            returnValue.push(bytes[x])
        }

        // TODO: ... probably should use struct.pack(">Q", n)
        while (returnValue.length != paddingTargetLength) {
            returnValue.unshift(0)
        }

        return returnValue
    }
}

export function longToByteArray(num: number): Array<number> {
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];

    for ( var index = 0; index < byteArray.length; index ++ ) {
        var some_byte = num & 0xff;
        byteArray [ index ] = some_byte;
        num = (num - some_byte) / 256 ;
    }

    return byteArray;
};

// for compatibility with the python wallet
export function hexToPaddedBytes(hex: string, paddingTargetLength: number = 32) {
    const bytes = hexToBytes(hex)
    return paddedBytes(bytes, paddingTargetLength)
}

export function convertSecretHexToBytes(secret: string) {
    return hexToPaddedBytes(secret)
}

export class SecretWebcash {
    amount: Decimal
    secret_value: string

    // If you need to deserialize webcash, then use deserializeWebcash to
    // create instantiated objects. Here, we only accept the direct parameters.
    constructor(amount: Decimal, secret_value: string) {
        validateAmountDecimals(amount)
        this.amount = amount
        this.secret_value = secret_value
    }

    static deserialize(webcash: string): SecretWebcash {
        return deserializeWebcash(webcash) as SecretWebcash
    }

    // Generate a new SecretWebcash from an amount with a new secret value.
    // This does not use the deterministic wallet.
    static fromAmount(amount: Decimal): SecretWebcash {
        return SecretWebcash.deserialize(createWebcashWithRandomSecretFromAmount(amount))
    }

    isEqual(other: PublicWebcash | SecretWebcash): boolean {
        if (other instanceof SecretWebcash) {
            if (this.secret_value == other.secret_value) {
                return true
            } else {
                return false
            }
        }

        else if (other instanceof PublicWebcash) {
            if (this.toPublic().hashed_value == other.hashed_value) {
                return true
            } else {
                return false
            }
        }

        return false
    }

    toString(): string {
        return `e${this.amount.toString()}:secret:${this.secret_value}`
    }

    toPublic() {
        const hashed_value = convertSecretValueToPublicValue(this.secret_value)
        return new PublicWebcash(this.amount, hashed_value)
    }
}

export class PublicWebcash {
    amount: Decimal
    hashed_value: string

    constructor(amount: Decimal, hashed_value: string) {
        validateAmountDecimals(amount)
        this.amount = amount
        this.hashed_value = hashed_value
    }

    // TODO: this might involve some type coercion if a secret value is
    // given...
    static deserialize(webcash: string): PublicWebcash {
        return deserializeWebcash(webcash) as PublicWebcash
    }

    isEqual(other: PublicWebcash | SecretWebcash): boolean {
        if (other instanceof SecretWebcash) {
            if (this.hashed_value == other.toPublic().hashed_value) {
                return true
            } else {
                return false
            }
        }

        if (other instanceof PublicWebcash) {
            if (this.hashed_value == other.hashed_value) {
                return true
            } else {
                return false
            }
        }

        return false
    }

    toString(): string {
        return `e${this.amount.toString()}:public:${this.hashed_value}`
    }
}

export interface WebcashWalletData {
    // TODO: better types
    version: string
    legalese: any
    webcash: any[]
    unconfirmed: any[]
    log: any[]
    master_secret: string
    walletdepths: any
}

const chainCodes: { [key: string]: number } = {
    "RECEIVE": 0,
    "PAY": 1,
    "CHANGE": 2,
    "MINING": 3,
}

export class WebcashWallet {
    // TODO: better types
    version: string
    legalese: any
    webcash: any[]
    unconfirmed: any[]
    log: any[]
    master_secret: string
    walletdepths: any

    constructor({
        legalese = {"terms": null},
        webcash = [],
        unconfirmed = [],
        log = [],
        master_secret = "",
        walletdepths = {
            "RECEIVE": 0,
            "PAY": 0,
            "CHANGE": 0,
            "MINING": 0, // not relevant
        },
        version = "1.0",
    }: Partial<WebcashWalletData> = {}) {
        this.version = version || "1.0"

        this.legalese = legalese || {"terms": null}

        this.webcash = webcash || []
        this.unconfirmed = unconfirmed || []
        this.log = log || []

        // Accept the given master_secret value or create a new random secret.
        this.master_secret = master_secret || ""
        if (typeof master_secret === "undefined" || master_secret === "") {
            this.master_secret = generateRandomValue(32)
        }

        this.walletdepths = walletdepths || {
            "RECEIVE": 0,
            "PAY": 0,
            "CHANGE": 0,
            "MINING": 0, // not relevant
        }
    }

    // Check that the legal agreements have been agreed to and acknowledged.
    public checkLegalAgreements() {
        if (this.legalese["terms"] != true) {
            return false
        } else if (this.legalese["terms"] == true) {
            return true
        }
    }

    public setLegalAgreementsToTrue() {
        this.legalese["terms"] = true;
    }

    public getContents() {
        return {
            master_secret: this.master_secret,
            walletdepths: this.walletdepths,

            webcash: this.webcash,
            unconfirmed: this.unconfirmed,
            log: this.log,

            version: this.version,
            legalese: this.legalese,
        }
    }

    // Calculate the balance based on the webcash in the wallet. This does not
    // make any requests to the server to check currentness.
    public getBalance(): Decimal {
        return this.webcash
            .map((n: string) => SecretWebcash.deserialize(n).amount)
            .reduce((prev: Decimal, next: Decimal) => {
                return prev.plus(next)
            }, new Decimal(0))
    }

    // Insert webcash into the wallet. Replace the given webcash with new
    // webcash.
    public async insert(webcash: string | SecretWebcash, memo: string = ""): Promise<any> {
        // deserialize the given webcash
        if (typeof webcash == "string") {
            webcash = SecretWebcash.deserialize(webcash)
        }

        // create a new secret webcash
        const new_webcash = new SecretWebcash(webcash.amount, this.generateNextSecret("RECEIVE"))

        // Check this.legalese before submitting an HTTP request.
        if (!this.checkLegalAgreements()) {
            throw new Error("User hasn't agreed to the legal terms.")
        }

        // prepare the replacement request
        const replace_request_body = {
            webcashes: [webcash.toString()],
            new_webcashes: [new_webcash.toString()],
            legalese: this.legalese,
        }

        // Save the new webcash into the wallet so that in the event that the
        // operation succeeded but there is a network error, that the wallet
        // will not lose the value of the webcash.
        const new_webcash_str = new_webcash.toString()
        this.unconfirmed.push(new_webcash_str)
        // .. somewhat unnecessary with the deterministic wallet.
        if (typeof (this as any).save !== "undefined") {
            (this as any).save()
        }

        // execute the replacement request
        try {
            //console.debug("Replacing..", JSON.stringify(replace_request_body))
            console.debug("Replacing..")

            const response = await fetch(REPLACE_API(), {
                body: JSON.stringify(replace_request_body),
                method: "post",
            })

            let response_content = await response.text()
            console.debug("After replace API call. Response = ", response_content)

            if (response.status != 200) {
                // TODO: save the wallet
                throw new Error("Server returned an error: " + response_content)
            }
        } catch (e) {
            // TODO: save the wallet
            console.log("Could not successfully call replacement API")
            throw e
        }

        // remove from unconfirmeds
        this.unconfirmed = this.unconfirmed.filter(item => item !== new_webcash_str)

        this.webcash.push(new_webcash.toString())
        this.log.push({
            type: "insert",
            amount: new_webcash.amount.toString(),
            webcash: webcash.toString(),
            new_webcash: new_webcash_str,
            memo: memo,
            timestamp: Date.now().toString(),
        })

        // TODO: save the wallet!!!
        return new_webcash.toString()
    }

    // Make a payment in the exact amount specified.
    public async pay(amount: Decimal | number, memo=''): Promise<string> {
        if (!(amount instanceof Decimal)) {
            amount = new Decimal(amount)
        }

        // Check this.legalese before submitting an HTTP request.
        if (!this.checkLegalAgreements()) {
            throw new Error("User hasn't agreed to the legal terms.")
        }

        // TODO: split coin selection out of this function

        let haveEnough = false
        let inputWebcash: SecretWebcash[] = []

        // Try to satisfy the request with a single payment that matches the
        // size.
        for (let i = 0, l = this.webcash.length; i < l; i++) {
            const webcash = SecretWebcash.deserialize(this.webcash[i])
            if (webcash.amount.gte(amount)) {
                inputWebcash.push(webcash)
                haveEnough = true
                break
            }
        }

        if (!haveEnough) {
            let runningAmount = new Decimal(0)
            let runningWebcash: SecretWebcash[] = []

            for (let i =0, l = this.webcash.length; i < l; i++) {
                const webcash = SecretWebcash.deserialize(this.webcash[i])

                runningAmount = runningAmount.plus(webcash.amount)
                runningWebcash.push(webcash)

                if (runningAmount.gte(amount)) {
                    inputWebcash = runningWebcash
                    haveEnough = true
                    break
                }
            }
        }

        if (!haveEnough) {
            //console.error("Wallet does not have enough funds to make the transfer.")
            throw new Error("Wallet does not have enough funds to make the transfer.")
        }

        const foundAmount = inputWebcash
            .map((w: SecretWebcash) => w.amount)
            .reduce((prev: Decimal, next: Decimal) => {
                return prev.plus(next)
            }, new Decimal(0))

        let changeAmount = new Decimal(foundAmount)
        changeAmount = changeAmount.minus(amount.toString())
        // TODO: does minus take a string parameter??

        let changeWebcash
        const new_webcash = []

        //if (changeAmount > new Decimal(0)) {
        if (changeAmount.gt(new Decimal(0))) {
            changeWebcash = new SecretWebcash(changeAmount, this.generateNextSecret("CHANGE"))
            new_webcash.push(changeWebcash.toString())
        }

        const transferWebcash = new SecretWebcash(amount, this.generateNextSecret("PAY"))
        new_webcash.push(transferWebcash.toString())

        // prepare the replacement request
        const replace_request_body = {
            webcashes: inputWebcash.map((n) => n.toString()),
            new_webcashes: new_webcash,
            legalese: this.legalese,
        }

        // Save the new webcash into the wallet so that in the event that the
        // operation succeeded but there is a network error, that the wallet
        // will not lose the value of the webcash.
        this.unconfirmed.push(transferWebcash.toString())
        if (typeof changeWebcash !== "undefined") {
            this.unconfirmed.push(changeWebcash.toString())
        }
        // .. somewhat unnecessary with the deterministic wallet.
        if (typeof (this as any).save !== "undefined") {
            (this as any).save()
        }

        // execute the replacement request
        try {
            const response = await fetch(REPLACE_API(), {
                body: JSON.stringify(replace_request_body),
                method: "post",
            })

            const response_content = await response.text()

            if (response.status != 200) {
                throw new Error("Server returned an error: " + response_content)
            }
        } catch (e) {
            console.log("Could not successfully call the replacement API")
            throw e
        }

        // remove the webcash from the wallet
        this.webcash = this.webcash.filter(n => !replace_request_body.webcashes.includes(n))

        // remove the unconfirmed webcash too
        const transferWebcash_str = transferWebcash.toString()
        this.unconfirmed = this.unconfirmed.filter(item => item !== transferWebcash_str)
        if (typeof changeWebcash !== "undefined") {
            const changeWebcash_str = changeWebcash.toString()
            this.unconfirmed = this.unconfirmed.filter(item => item !== changeWebcash_str)
        }

        // record change
        if (changeAmount && !(typeof changeWebcash === "undefined")) {
            this.webcash.push(changeWebcash.toString())

            this.log.push({
                type: "change",
                amount: changeAmount.toString(),
                webcash: changeWebcash.toString(),
                timestamp: Date.now().toString(),
            })
        }

        // record payment
        this.log.push({
            type: "payment",
            amount: transferWebcash.amount.toString(),
            webcash: transferWebcash.toString(),
            memo: memo,
            timestamp: Date.now().toString(),
        })

        // TODO: save the wallet!!! update something to indicate that the
        // wallet has been modified since last saved.

        return transferWebcash.toString()
    }

    public processHealthcheckResults(results: any, webcashesMap: {[key: string]: string} = {}) {
        for (var key in results) {
            if (results.hasOwnProperty(key)) {
                const publicWebcash: string = key
                const result: any = results[key]
                const hashed_value = PublicWebcash.deserialize(publicWebcash).hashed_value
                const wallet_cash = SecretWebcash.deserialize(webcashesMap[hashed_value])
                if (result["spent"] === false) {
                    // Check the amount.
                    const result_amount = new Decimal(result["amount"])
                    if (!result_amount.equals(wallet_cash.amount)) {
                        console.log("Wallet was mistaken about amount stored by a certain webcash. Updating.")
                        this.webcash = this.webcash.filter(item => item !== webcashesMap[hashed_value])
                        this.webcash.push(new SecretWebcash(result_amount, wallet_cash.secret_value).toString())
                    } else {
                        //console.log("Amount was correct.")
                    }
                } else if ([null, true].includes(result["spent"])) {
                    // Invalid webcash found. Remove from wallet.
                    console.log("Removing some webcash.")
                    this.webcash = this.webcash.filter(item => item !== webcashesMap[hashed_value])
                    this.unconfirmed.push(webcashesMap[hashed_value])
                } else {
                    throw new Error("Invalid webcash status: " + result["spent"].toString())
                }
            }
        }
    }

    // Check every webcash in the wallet and remove any invalid already-spent
    // webcash.
    public async check(): Promise<void> {
        const webcashes: {[key: string]: string} = {}
        this.webcash.forEach(webcash => {
            const sk = SecretWebcash.deserialize(webcash)
            const hashed_value = sk.toPublic().hashed_value

            // Detect and remove duplicates.
            if (hashed_value in webcashes) {
                console.log("Duplicate webcash detected in wallet, moving it to unconfirmed")
                this.unconfirmed.push(webcash)

                // remove all copies
                this.webcash = this.webcash.filter(item => item !== webcash)

                // add one copy back for a total of one
                this.webcash.push(webcash)

                if (typeof (this as any).save !== "undefined") {
                    (this as any).save()
                }
            }

            // Make a map from the hashed value back to the webcash which can
            // be used for lookups when the server gives a response.
            webcashes[hashed_value] = webcash
        })

        const chunks = chunkArray(this.webcash, 25)
        //await chunks.forEach(async (chunk) => { ... })
        //... except forEach does not work with async/await.
        for (const chunk of chunks) {
            //const healthCheckRequest: Array<string> = chunk
            //  .map((webcash: string) => SecretWebcash.deserialize(webcash).toPublic().toString())
            const healthCheckRequest: Array<string> = chunk

            try {
                const response = await fetch(HEALTHCHECK_API(), {
                    body: JSON.stringify(healthCheckRequest),
                    method: "post",
                })

                const response_content = await response.text()
                if (response.status != 200) {
                    throw new Error("Server returned an error: " + response_content)
                }

                const response_data = JSON.parse(response_content)
                let results = response_data["results"]
                this.processHealthcheckResults(results, webcashes)
            } catch (e) {
                console.log("Could not successfully call the healthcheck API")
                throw e
            }
        }
    }

    public async recover(gaplimit: number = 20): Promise<void> {
        // gaplimit is the maximum window span that will be used, on the
        // assumption that any valid webcash will be found within the last item
        // plus gaplimit number more of the secrets.

        // Start by healthchecking the contents of the wallet.
        await this.check()

        for (var chainCode in this.walletdepths) {
            if (this.walletdepths.hasOwnProperty(chainCode)) {
                // keep track of how far along the process is
                let current_walletdepth: number = 0
                let reported_walletdepth: number = this.walletdepths[chainCode]

                let _idx: number = 0
                let last_used_walletdepth: number = 0
                let has_had_webcash: boolean = true
                while (has_had_webcash === true) {
                    console.log("Checking gaplimit " + gaplimit.toString() + " secrets for chainCode " + chainCode.toString() + ", round " + _idx.toString())

                    // assume this is the last iteration
                    has_had_webcash = false

                    // Check the next gaplimit number of secrets. Continue to
                    // the next round if any of the secrets have ever been
                    // used, regardless of whether they still have webcash
                    // value.

                    const healthCheckRequest: Array<string> = []
                    const check_webcashes: {[key: string]: SecretWebcash} = {}
                    const walletdepths: {[key: string]: number} = {}
                    range(current_walletdepth, current_walletdepth + gaplimit).forEach(x => {
                        let secret = this.generateNextSecret(chainCode, x)
                        let webcash = new SecretWebcash(new Decimal(1), secret)
                        let publicWebcash = webcash.toPublic()
                        check_webcashes[publicWebcash.hashed_value] = webcash
                        walletdepths[publicWebcash.hashed_value] = x
                        healthCheckRequest.push(publicWebcash.toString())
                    })

                    // fetch the response from the healthcheck API
                    try {
                        const response = await fetch(HEALTHCHECK_API(), {
                            body: JSON.stringify(healthCheckRequest),
                            method: "post",
                        })

                        const response_content = await response.text()
                        if (response.status != 200) {
                            throw new Error("Server returned an error: " + response_content)
                        }

                        const response_data = JSON.parse(response_content)
                        let results = response_data["results"]
                        console.log("results = ", JSON.stringify(results))

                        // use results and check_webcashes to process
                        for (var resultkey in results) {
                            if (results.hasOwnProperty(resultkey)) {
                                let public_webcash: PublicWebcash = PublicWebcash.deserialize(resultkey)
                                let result = results[resultkey]

                                if (result["spent"] !== null) {
                                    has_had_webcash = true
                                    last_used_walletdepth = walletdepths[public_webcash.hashed_value]
                                }

                                if (result["spent"] === false) {
                                    let swc = check_webcashes[public_webcash.hashed_value]
                                    swc.amount = new Decimal(result["amount"])
                                    if (chainCode !== "PAY" && !this.webcash.includes(swc.toString())) {
                                        console.log("Recovered webcash: ", swc.amount.toString())
                                        this.webcash.push(swc.toString())
                                    } else {
                                        console.log("Found known webcash of amount: ", swc.amount.toString())
                                    }
                                }
                            }
                        }

                        if (current_walletdepth < reported_walletdepth) {
                            has_had_webcash = true
                        }

                        if (has_had_webcash) {
                            current_walletdepth = current_walletdepth + gaplimit
                        }

                        _idx += 1
                    } catch (e) {
                        console.log("Could not successfully call the healthcheck API")
                        throw e
                    }
                }

                if (reported_walletdepth > last_used_walletdepth + 1) {
                    console.log("Something may have gone wrong: reported walletdepth was " + reported_walletdepth.toString() + " but only found up to " + last_used_walletdepth.toString() + " depth.")
                }

                if (reported_walletdepth < last_used_walletdepth) {
                    this.walletdepths[chainCode] = last_used_walletdepth + 1
                }
            }
        }

        if (typeof (this as any).save !== "undefined") {
            (this as any).save()
        }
    }

    // TODO: should this be async?
    // TODO: should this be private instead of public?
    public generateNextSecret(chainCode: string, seek: any = false): string {
        let walletdepth = 0;

        if (seek === false) {
            walletdepth = this.walletdepths[chainCode]
        } else {
            walletdepth = seek
        }

        const master_secret = this.master_secret
        const master_secret_bytes = convertSecretHexToBytes(master_secret)

        const chainCoded = chainCodes[chainCode]

        // [119, 101, 98, 99, 97, 115, 104, 119, 97, 108, 108, 101, 116, 118, 49] == webcashwalletv1
        const tag = sha256FromArray([119, 101, 98, 99, 97, 115, 104, 119, 97, 108, 108, 101, 116, 118, 49])

        const array = new Array()
        const tagnumbers = Array.from(tag.entries()).map((x: any) => x[1])
        array.push.apply(array, tagnumbers)
        array.push.apply(array, tagnumbers)
        array.push.apply(array, master_secret_bytes)

        array.push.apply(array, longToByteArray(chainCoded).reverse())
        array.push.apply(array, longToByteArray(walletdepth).reverse())

        const new_secret = sha256FromArray(array)

        // aaaaa there must be a better way
        var new_hex_secret
        if (typeof window !== "undefined") {
            // @ts-ignore
            new_hex_secret = new_secret.toString("hex")
        } else {
            //const new_hex_secret = Buffer.from(new_secret).toString("hex")
            new_hex_secret = Buffer.from(new_secret).toString("hex")
        }

        if (seek === false) {
            // TODO: mark something on the wallet to indicate that it has been
            // modified since last save.
            this.walletdepths[chainCode] += 1
        }

        return new_hex_secret
    }
}

let MEMORY: Partial<WebcashWalletData> = {}
export class WebcashWalletMemory extends WebcashWallet {
    public static create(walletdata: Partial<WebcashWalletData> = {}): WebcashWallet {
        const wallet = new WebcashWalletMemory(walletdata)
        wallet.save()
        return wallet
    }

    public static load(): WebcashWallet | undefined {
        const contents = { ...MEMORY }
        if (contents) {
            console.log("Loaded wallet from memory.")
            return new WebcashWalletMemory(contents)
        } else {
            console.warn("Couldn't load wallet from memory.")
            return
        }
    }

    public save(): boolean {
        const contents = this.getContents()
        MEMORY = contents
        console.log("Saved wallet to memory.")
        return true
    }
}

/*
import { readFileSync, writeFileSync } from "fs"
export class WebcashWalletFileSystem extends WebcashWallet {
    const defaultFilename: string = "default_wallet.webcash"

    public static create(walletdata: Partial<WebcashWalletData> = {}): WebcashWallet {
        const wallet = new WebcashWalletFileSystem(walletdata)
        wallet.save()
        return wallet
    }

    public static load(): WebcashWallet | undefined {
        const contents = readFileSync(this.defaultFilename, "utf8")
        if (contents) {
            let wallet = new WebcashWalletFileSystem(JSON.parse(contents))
            console.log("Loaded wallet from the file system.")
            return wallet
        } else {
            console.warn("Couldn't load wallet from the file system.")
            return
        }
    }

    public save(): boolean {
        const contents = this.getContents()
        const jsonContents = JSON.stringify(contents, null, 4)
        writeFileSync(this.defaultFilename, jsonContents, "utf8")
        console.log("Saved wallet to the file system: " + this.defaultFilename)
        return true
    }
}
*/

const defaultLocalStorageKey: string = "wallet"
export class WebcashWalletLocalStorage extends WebcashWallet {

    public static create(walletdata: Partial<WebcashWalletData> = {}): WebcashWallet {
        const wallet = new WebcashWalletLocalStorage(walletdata)
        wallet.save()
        return wallet
    }

    public static load(): WebcashWallet | undefined {
        const contents = window.localStorage.getItem(defaultLocalStorageKey)
        if (contents) {
            let wallet = new WebcashWalletLocalStorage(JSON.parse(contents))
            console.log("Loaded wallet from localStorage")
            return wallet
        } else {
            console.warn("Couldn't load wallet from localStorage")
            return
        }
    }

    public save(): boolean {
        const contents = this.getContents()
        const jsonContents = JSON.stringify(contents, null, 4)
        window.localStorage.setItem(defaultLocalStorageKey, jsonContents)
        console.log("Saved wallet to localStorage under key " + defaultLocalStorageKey)
        return true
    }
}
