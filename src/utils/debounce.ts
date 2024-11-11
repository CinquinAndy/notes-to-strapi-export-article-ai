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
					Logger.debug('Debounce', '97. Cleanup completed')
				}
			}, waitFor)
		})
	}
}
