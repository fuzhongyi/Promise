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
        this.onFulfilled.forEach(fn => fn()); // PromiseA+ 2.2.6.1
      }
    };

    const reject = reason => {
      if (this.state === PENDING) {
        this.state = REJECTED;
        this.reason = reason;
        this.onRejected.forEach(fn => fn()); // PromiseA+ 2.2.6.1
      }
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }


  then(onFulfilled, onRejected) {
    // PromiseA+ 2.2.1 / PromiseA+ 2.2.5 / PromiseA+ 2.2.7.3 / PromiseA+ 2.2.7.4
    // 值穿透 promise.then().then().then(res => { console.log(res); })
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : value => value;
    onRejected = typeof onRejected === "function" ? onRejected : reason => { throw reason; };
    // PromiseA+ 2.2.7 返回一个新的 Promise
    let promise2 = new Promise((resolve, reject) => {
      if (this.state === FULFILLED) {
        // PromiseA+ 2.2.2
        // PromiseA+ 2.2.4 --- setTimeout 模拟异步任务（规范要求）
        setTimeout(() => {
          try {
            // PromiseA+ 2.2.7.1
            let x = onFulfilled(this.value);
            handlePromise(promise2, x, resolve, reject);
          } catch (e) {
            // PromiseA+ 2.2.7.2
            reject(e);
          }
        });
      } else if (this.state === REJECTED) {
        // PromiseA+ 2.2.3
        setTimeout(() => {
          try {
            let x = onRejected(this.reason);
            handlePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      } else if (this.state === PENDING) {
        this.onFulfilled.push(() => {
          setTimeout(() => {
            try {
              let x = onFulfilled(this.value);
              handlePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          });
        });
        this.onRejected.push(() => {
          setTimeout(() => {
            try {
              let x = onRejected(this.reason);
              handlePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          });
        });
      }
    });
    return promise2;
  }
}

function handlePromise(promise2, x, resolve, reject) {
  // PromiseA+ 2.3.1 promise2 是否等于x，判断是否将自己本身返回，抛出 TypeError 错误
  if (promise2 === x) {
    reject(new TypeError('Chaining cycle'));
  }
  // PromiseA+ 2.3.3
  if (x && typeof x === 'object' || typeof x === 'function') {
    let used; // PromiseA+ 2.3.3.3.3 控制 resolve 或 reject 只执行一次，多次调用没有任何作用（规范要求）
    try {
      // PromiseA+ 2.3.3.1
      let then = x.then;
      // 如果是函数，就认为它是返回新的 promise
      if (typeof then === 'function') {
        // PromiseA+ 2.3.3.1
        then.call(x, (y) => {
          if (used) return;
          used = true;
          handlePromise(promise2, y, resolve, reject);
        }, (r) => {
          // PromiseA+ 2.3.3.2
          if (used) return;
          used = true;
          reject(r);
        });
      } else {
        // PromiseA+ 2.3.3.4 x 是普通值，直接返回
        if (used) return;
        used = true;
        resolve(x);
      }
    } catch (e) {
      // PromiseA+ 2.3.3.2
      if (used) return;
      used = true;
      reject(e);
    }
  } else {
    // PromiseA+ 2.3.4 x 是普通值，直接返回
    resolve(x);
  }
}

// Promise/A+ 测试脚本 promises-aplus-tests 所谓代码
Promise.defer = Promise.deferred = function () {
  let dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
}

module.exports = Promise;