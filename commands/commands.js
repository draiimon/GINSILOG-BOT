const { EmbedBuilder } = require('discord.js');
const { getErrorMessage, getSuccessMessage } = require('../utils/messages');

const commands = {
    tulong: {
        execute: async (message) => {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔥 PUTANGINA! KAILANGAN MO TULONG? ETO COMMANDS KO GAGO! 🔥')
                .setDescription(
                    '**MUSIC COMMANDS PARA SA MGA BOBONG KATULAD MO:**\n\n' +
                    '`g!play` - MAGPATUGTOG NG KANTA GAGO!\n' +
                    '`g!pause` - TEKA LANG! IHINTO MUNA SANDALI!\n' +
                    '`g!resume` - SIGE NA! ITULOY MO NA YANG KANTA!\n' +
                    '`g!stop` - TAMA NA! TIGIL NA YANG KANTA!\n' +
                    '`g!skip` - AYAW MO? LAKTAWAN NATIN YANG KANTA!\n' +
                    '`g!queue` - TINGNAN MO LINEUP NG MGA KANTA!\n' +
                    '`g!clear` - TANGINA BURAHIN LAHAT NG NASA QUEUE!\n' +
                    '`g!loop` - ULITIN NATIN YANG KANTA HANGGANG MAGSAWA KA!\n' +
                    '`g!volume` - LAKASAN O HINAAN MO GAGO!\n\n' +
                    '**PUTANGINA NAPAKADALI LANG GAMITIN! BOBO KA LANG SIGURO KUNG DI MO MAGAMIT! 🤬**'
                )
                .setFooter({ text: 'GAWA NG PINAKA ASTIG NA BOT SA BUONG UNIVERSE! WAG KANG MAGHANAP NG IBA KINGINA MO!' });

            message.channel.send({ embeds: [embed] });
        }
    },

    play: {
        execute: async (message, args) => {
            try {
                if (!message.member.voice.channel) {
                    return message.reply(getErrorMessage('NOT_IN_VOICE'));
                }

                const query = args.join(' ');
                if (!query) {
                    return message.reply(getErrorMessage('NO_QUERY'));
                }

                const player = message.client.riffy.createPlayer({
                    guildId: message.guild.id,
                    textChannel: message.channel.id,
                    voiceChannel: message.member.voice.channel.id
                });

                const track = await player.search(query);
                if (!track) {
                    return message.reply(getErrorMessage('NO_RESULTS'));
                }

                track.requestedBy = message.author.username;
                player.queue.add(track);

                if (!player.playing) {
                    await player.play();
                }

                message.reply(getSuccessMessage('ADDED_TO_QUEUE', track.title));
            } catch (error) {
                console.error('PUTANGINA MAY ERROR SA PLAY:', error);
                message.reply(getErrorMessage('PLAY_ERROR'));
            }
        }
    },

    stop: {
        execute: async (message) => {
            const player = message.client.riffy.players.get(message.guild.id);
            if (!player) {
                return message.reply(getErrorMessage('NOT_PLAYING'));
            }

            player.destroy();
            message.reply(getSuccessMessage('STOPPED'));
        }
    },

    skip: {
        execute: async (message) => {
            const player = message.client.riffy.players.get(message.guild.id);
            if (!player) {
                return message.reply(getErrorMessage('NOT_PLAYING'));
            }

            player.stop();
            message.reply(getSuccessMessage('SKIPPED'));
        }
    },

    pause: {
        execute: async (message) => {
            const player = message.client.riffy.players.get(message.guild.id);
            if (!player) {
                return message.reply(getErrorMessage('NOT_PLAYING'));
            }

            player.pause(true);
            message.reply(getSuccessMessage('PAUSED'));
        }
    },

    resume: {
        execute: async (message) => {
            const player = message.client.riffy.players.get(message.guild.id);
            if (!player) {
                return message.reply(getErrorMessage('NOT_PLAYING'));
            }

            player.pause(false);
            message.reply(getSuccessMessage('RESUMED'));
        }
    },

    volume: {
        execute: async (message, args) => {
            const player = message.client.riffy.players.get(message.guild.id);
            if (!player) {
                return message.reply(getErrorMessage('NOT_PLAYING'));
            }

            const volume = parseInt(args[0]);
            if (isNaN(volume) || volume < 0 || volume > 150) {
                return message.reply('TANGINA MO! 0-150 LANG PWEDE SA VOLUME! HINDI PWEDENG LAGPAS O KULANG! BOBO KA BA?! 🔊');
            }

            player.setVolume(volume);
            message.reply(getSuccessMessage('VOLUME_CHANGED', volume));
        }
    },

    loop: {
        execute: async (message) => {
            const player = message.client.riffy.players.get(message.guild.id);
            if (!player) {
                return message.reply(getErrorMessage('NOT_PLAYING'));
            }

            const isLooping = player.loop === 'track';
            player.setLoop(isLooping ? 'none' : 'track');
            message.reply(isLooping ? getSuccessMessage('LOOP_OFF') : getSuccessMessage('LOOP_ON'));
        }
    },

    queue: {
        execute: async (message) => {
            const player = message.client.riffy.players.get(message.guild.id);
            if (!player || !player.queue.length) {
                return message.reply(getErrorMessage('EMPTY_QUEUE'));
            }

            const musicPlayer = new MusicPlayer(message.client);
            const queueMessage = musicPlayer.getQueueMessage(player);
            message.channel.send(queueMessage);
        }
    },

    clear: {
        execute: async (message) => {
            const player = message.client.riffy.players.get(message.guild.id);
            if (!player) {
                return message.reply(getErrorMessage('NOT_PLAYING'));
            }

            player.queue.clear();
            message.reply(getSuccessMessage('QUEUE_CLEARED'));
        }
    }
};

module.exports = commands;
