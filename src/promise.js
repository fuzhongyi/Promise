const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

class Promise {
  constructor(executor) {
    this.state = PENDING;
    this.onFulfilled = []; // 成功回调队列
    this.onRejected = []; // 失败回调队列

    const resolve = value => {
      if (this.state === PENDING) {
        this.state = FULFILLED;
        this.value = value;
        this.onFulfilled.forEach(fn => fn());
      }
    };

    const reject = reason => {
      if (this.state === PENDING) {
        this.state = REJECTED;
        this.reason = reason;
        this.onRejected.forEach(fn => fn());
      }
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  then(onFulfilled, onRejected) {
    if (this.state === PENDING) {
      this.onFulfilled.push(() => onFulfilled(this.value));
      this.onRejected.push(() => onRejected(this.reason));
    }
  }
}