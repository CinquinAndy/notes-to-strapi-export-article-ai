import { Logger } from './logger'

/**
 * Creates a debounced version of the provided function
 * @param func The function to debounce
 * @param waitFor The time to wait in milliseconds
 * @returns A debounced version of the function that returns a promise
 */
export function debounce<F extends (...args: any[]) => any>(
	func: F,
	waitFor: number
): (...args: Parameters<F>) => Promise<ReturnType<F>> {
	Logger.info('Debounce', '90. Creating debounced function', {
		waitTime: waitFor,
		functionName: func.name || 'anonymous',
	})

	let timeout: ReturnType<typeof setTimeout> | null = null
	let pendingPromise: Promise<ReturnType<F>> | null = null

	return (...args: Parameters<F>): Promise<ReturnType<F>> => {
		Logger.debug('Debounce', '91. Debounced function called with args', {
			args,
			hasExistingTimeout: !!timeout,
		})

		// Clear existing timeout if any
		if (timeout) {
			Logger.debug('Debounce', '92. Clearing existing timeout')
			clearTimeout(timeout)
			timeout = null
		}

		// Create new promise
		return new Promise((resolve, reject) => {
			Logger.debug('Debounce', '93. Setting up new timeout')

			timeout = setTimeout(async () => {
				try {
					Logger.debug('Debounce', '94. Executing debounced function')
					const result = await func(...args)
					Logger.debug('Debounce', '95. Function executed successfully')
					resolve(result)
				} catch (error) {
					Logger.error(
						'Debounce',
						'96. Error in debounced function execution',
						error
					)
					reject(error)
				} finally {
					timeout = null
					pendingPromise = null
					Logger.debug('Debounce', '97. Cleanup completed')
				}
			}, waitFor)
		})
	}
}

/**
 * Creates a debounced version of the provided function with cancellation support
 * @param func The function to debounce
 * @param waitFor The time to wait in milliseconds
 * @returns An object containing the debounced function and a cancel method
 */
export function debounceCancellable<F extends (...args: any[]) => any>(
	func: F,
	waitFor: number
): {
	debounced: (...args: Parameters<F>) => Promise<ReturnType<F>>
	cancel: () => void
} {
	Logger.info('Debounce', '98. Creating cancellable debounced function', {
		waitTime: waitFor,
		functionName: func.name || 'anonymous',
	})

	let timeout: ReturnType<typeof setTimeout> | null = null
	let pendingPromise: Promise<ReturnType<F>> | null = null

	const cancel = () => {
		Logger.info('Debounce', '99. Cancelling debounced function')
		if (timeout) {
			clearTimeout(timeout)
			timeout = null
			Logger.debug('Debounce', '100. Timeout cleared')
		}
	}

	const debounced = (...args: Parameters<F>): Promise<ReturnType<F>> => {
		Logger.debug('Debounce', '101. Cancellable debounced function called', {
			args,
			hasExistingTimeout: !!timeout,
		})

		// Clear existing timeout
		if (timeout) {
			Logger.debug('Debounce', '102. Clearing existing timeout')
			clearTimeout(timeout)
			timeout = null
		}

		return new Promise((resolve, reject) => {
			Logger.debug('Debounce', '103. Setting up new timeout')

			timeout = setTimeout(async () => {
				try {
					Logger.debug('Debounce', '104. Executing debounced function')
					const result = await func(...args)
					Logger.debug('Debounce', '105. Function executed successfully')
					resolve(result)
				} catch (error) {
					Logger.error(
						'Debounce',
						'106. Error in debounced function execution',
						error
					)
					reject(error)
				} finally {
					timeout = null
					pendingPromise = null
					Logger.debug('Debounce', '107. Cleanup completed')
				}
			}, waitFor)
		})
	}

	return { debounced, cancel }
}

/**
 * Type guard to check if a value is a Promise
 */
function isPromise<T>(value: any): value is Promise<T> {
	return value && typeof value.then === 'function'
}
