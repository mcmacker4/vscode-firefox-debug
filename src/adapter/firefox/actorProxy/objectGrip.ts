import { Log } from '../../util/log';
import { DebugConnection } from '../connection';
import { PendingRequests } from '../../util/pendingRequests';
import { ActorProxy } from './interface';

let log = Log.create('ObjectGripActorProxy');

/**
 * Proxy class for an object grip actor
 * ([docs](https://github.com/mozilla/gecko-dev/blob/master/devtools/docs/backend/protocol.md#objects),
 * [spec](https://github.com/mozilla/gecko-dev/blob/master/devtools/shared/specs/object.js))
 */
export class ObjectGripActorProxy implements ActorProxy {

	private _refCount = 0;

 	private pendingPrototypeAndPropertiesRequests = new PendingRequests<FirefoxDebugProtocol.PrototypeAndPropertiesResponse>();

	constructor(
		private grip: FirefoxDebugProtocol.ObjectGrip,
		private connection: DebugConnection
	) {
		this.connection.register(this);
	}

	public get name() {
		return this.grip.actor;
	}

	public get refCount() {
		return this._refCount;
	}

	public increaseRefCount() {
		this._refCount++;
	}

	public decreaseRefCount() {
		this._refCount--;
		if (this._refCount === 0) {
			this.connection.unregister(this);
		}
	}

	public fetchPrototypeAndProperties(): Promise<FirefoxDebugProtocol.PrototypeAndPropertiesResponse> {

		if (log.isDebugEnabled()) {
			log.debug(`Fetching prototype and properties from ${this.name}`);
		}

		return new Promise<FirefoxDebugProtocol.PrototypeAndPropertiesResponse>((resolve, reject) => {
			this.pendingPrototypeAndPropertiesRequests.enqueue({ resolve, reject });
			this.connection.sendRequest({ to: this.name, type: 'prototypeAndProperties' });
		});
	}

	public receiveResponse(response: FirefoxDebugProtocol.Response): void {

		if ((response['prototype'] !== undefined) && (response['ownProperties'] !== undefined)) {

			if (log.isDebugEnabled()) {
				log.debug(`Prototype and properties fetched from ${this.name}`);
			}
			this.pendingPrototypeAndPropertiesRequests.resolveOne(<FirefoxDebugProtocol.PrototypeAndPropertiesResponse>response);

		} else if (response['error'] === 'noSuchActor') {

			log.warn(`No such actor ${this.grip.actor} - you will not be able to inspect this value; this is probably due to Firefox bug #1249962`);
			this.pendingPrototypeAndPropertiesRequests.rejectAll('No such actor');

		} else {

			log.warn("Unknown message from ObjectGripActor: " + JSON.stringify(response));

		}
	}
}
