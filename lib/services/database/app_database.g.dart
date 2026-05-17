// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $PlaybackQueuesTable extends PlaybackQueues
    with TableInfo<$PlaybackQueuesTable, PlaybackQueue> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PlaybackQueuesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _trackIdMeta = const VerificationMeta(
    'trackId',
  );
  @override
  late final GeneratedColumn<String> trackId = GeneratedColumn<String>(
    'track_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _artistMeta = const VerificationMeta('artist');
  @override
  late final GeneratedColumn<String> artist = GeneratedColumn<String>(
    'artist',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _albumMeta = const VerificationMeta('album');
  @override
  late final GeneratedColumn<String> album = GeneratedColumn<String>(
    'album',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _durationMeta = const VerificationMeta(
    'duration',
  );
  @override
  late final GeneratedColumn<int> duration = GeneratedColumn<int>(
    'duration',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _coverArtMeta = const VerificationMeta(
    'coverArt',
  );
  @override
  late final GeneratedColumn<String> coverArt = GeneratedColumn<String>(
    'cover_art',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isStarredMeta = const VerificationMeta(
    'isStarred',
  );
  @override
  late final GeneratedColumn<bool> isStarred = GeneratedColumn<bool>(
    'is_starred',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_starred" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _ratingMeta = const VerificationMeta('rating');
  @override
  late final GeneratedColumn<int> rating = GeneratedColumn<int>(
    'rating',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _sortIndexMeta = const VerificationMeta(
    'sortIndex',
  );
  @override
  late final GeneratedColumn<int> sortIndex = GeneratedColumn<int>(
    'sort_index',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _isActiveMeta = const VerificationMeta(
    'isActive',
  );
  @override
  late final GeneratedColumn<bool> isActive = GeneratedColumn<bool>(
    'is_active',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_active" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _playbackStateMeta = const VerificationMeta(
    'playbackState',
  );
  @override
  late final GeneratedColumn<String> playbackState = GeneratedColumn<String>(
    'playback_state',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('initial'),
  );
  static const VerificationMeta _localPathMeta = const VerificationMeta(
    'localPath',
  );
  @override
  late final GeneratedColumn<String> localPath = GeneratedColumn<String>(
    'local_path',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    trackId,
    title,
    artist,
    album,
    duration,
    coverArt,
    isStarred,
    rating,
    sortIndex,
    isActive,
    playbackState,
    localPath,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'playback_queues';
  @override
  VerificationContext validateIntegrity(
    Insertable<PlaybackQueue> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('track_id')) {
      context.handle(
        _trackIdMeta,
        trackId.isAcceptableOrUnknown(data['track_id']!, _trackIdMeta),
      );
    } else if (isInserting) {
      context.missing(_trackIdMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    }
    if (data.containsKey('artist')) {
      context.handle(
        _artistMeta,
        artist.isAcceptableOrUnknown(data['artist']!, _artistMeta),
      );
    }
    if (data.containsKey('album')) {
      context.handle(
        _albumMeta,
        album.isAcceptableOrUnknown(data['album']!, _albumMeta),
      );
    }
    if (data.containsKey('duration')) {
      context.handle(
        _durationMeta,
        duration.isAcceptableOrUnknown(data['duration']!, _durationMeta),
      );
    }
    if (data.containsKey('cover_art')) {
      context.handle(
        _coverArtMeta,
        coverArt.isAcceptableOrUnknown(data['cover_art']!, _coverArtMeta),
      );
    }
    if (data.containsKey('is_starred')) {
      context.handle(
        _isStarredMeta,
        isStarred.isAcceptableOrUnknown(data['is_starred']!, _isStarredMeta),
      );
    }
    if (data.containsKey('rating')) {
      context.handle(
        _ratingMeta,
        rating.isAcceptableOrUnknown(data['rating']!, _ratingMeta),
      );
    }
    if (data.containsKey('sort_index')) {
      context.handle(
        _sortIndexMeta,
        sortIndex.isAcceptableOrUnknown(data['sort_index']!, _sortIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_sortIndexMeta);
    }
    if (data.containsKey('is_active')) {
      context.handle(
        _isActiveMeta,
        isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta),
      );
    }
    if (data.containsKey('playback_state')) {
      context.handle(
        _playbackStateMeta,
        playbackState.isAcceptableOrUnknown(
          data['playback_state']!,
          _playbackStateMeta,
        ),
      );
    }
    if (data.containsKey('local_path')) {
      context.handle(
        _localPathMeta,
        localPath.isAcceptableOrUnknown(data['local_path']!, _localPathMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  PlaybackQueue map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PlaybackQueue(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      trackId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}track_id'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      artist: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}artist'],
      )!,
      album: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}album'],
      )!,
      duration: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}duration'],
      )!,
      coverArt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cover_art'],
      ),
      isStarred: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_starred'],
      )!,
      rating: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}rating'],
      )!,
      sortIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sort_index'],
      )!,
      isActive: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_active'],
      )!,
      playbackState: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}playback_state'],
      )!,
      localPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_path'],
      ),
    );
  }

  @override
  $PlaybackQueuesTable createAlias(String alias) {
    return $PlaybackQueuesTable(attachedDatabase, alias);
  }
}

class PlaybackQueue extends DataClass implements Insertable<PlaybackQueue> {
  final int id;
  final String trackId;
  final String title;
  final String artist;
  final String album;
  final int duration;
  final String? coverArt;
  final bool isStarred;
  final int rating;
  final int sortIndex;
  final bool isActive;
  final String playbackState;
  final String? localPath;
  const PlaybackQueue({
    required this.id,
    required this.trackId,
    required this.title,
    required this.artist,
    required this.album,
    required this.duration,
    this.coverArt,
    required this.isStarred,
    required this.rating,
    required this.sortIndex,
    required this.isActive,
    required this.playbackState,
    this.localPath,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['track_id'] = Variable<String>(trackId);
    map['title'] = Variable<String>(title);
    map['artist'] = Variable<String>(artist);
    map['album'] = Variable<String>(album);
    map['duration'] = Variable<int>(duration);
    if (!nullToAbsent || coverArt != null) {
      map['cover_art'] = Variable<String>(coverArt);
    }
    map['is_starred'] = Variable<bool>(isStarred);
    map['rating'] = Variable<int>(rating);
    map['sort_index'] = Variable<int>(sortIndex);
    map['is_active'] = Variable<bool>(isActive);
    map['playback_state'] = Variable<String>(playbackState);
    if (!nullToAbsent || localPath != null) {
      map['local_path'] = Variable<String>(localPath);
    }
    return map;
  }

  PlaybackQueuesCompanion toCompanion(bool nullToAbsent) {
    return PlaybackQueuesCompanion(
      id: Value(id),
      trackId: Value(trackId),
      title: Value(title),
      artist: Value(artist),
      album: Value(album),
      duration: Value(duration),
      coverArt: coverArt == null && nullToAbsent
          ? const Value.absent()
          : Value(coverArt),
      isStarred: Value(isStarred),
      rating: Value(rating),
      sortIndex: Value(sortIndex),
      isActive: Value(isActive),
      playbackState: Value(playbackState),
      localPath: localPath == null && nullToAbsent
          ? const Value.absent()
          : Value(localPath),
    );
  }

  factory PlaybackQueue.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PlaybackQueue(
      id: serializer.fromJson<int>(json['id']),
      trackId: serializer.fromJson<String>(json['trackId']),
      title: serializer.fromJson<String>(json['title']),
      artist: serializer.fromJson<String>(json['artist']),
      album: serializer.fromJson<String>(json['album']),
      duration: serializer.fromJson<int>(json['duration']),
      coverArt: serializer.fromJson<String?>(json['coverArt']),
      isStarred: serializer.fromJson<bool>(json['isStarred']),
      rating: serializer.fromJson<int>(json['rating']),
      sortIndex: serializer.fromJson<int>(json['sortIndex']),
      isActive: serializer.fromJson<bool>(json['isActive']),
      playbackState: serializer.fromJson<String>(json['playbackState']),
      localPath: serializer.fromJson<String?>(json['localPath']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'trackId': serializer.toJson<String>(trackId),
      'title': serializer.toJson<String>(title),
      'artist': serializer.toJson<String>(artist),
      'album': serializer.toJson<String>(album),
      'duration': serializer.toJson<int>(duration),
      'coverArt': serializer.toJson<String?>(coverArt),
      'isStarred': serializer.toJson<bool>(isStarred),
      'rating': serializer.toJson<int>(rating),
      'sortIndex': serializer.toJson<int>(sortIndex),
      'isActive': serializer.toJson<bool>(isActive),
      'playbackState': serializer.toJson<String>(playbackState),
      'localPath': serializer.toJson<String?>(localPath),
    };
  }

  PlaybackQueue copyWith({
    int? id,
    String? trackId,
    String? title,
    String? artist,
    String? album,
    int? duration,
    Value<String?> coverArt = const Value.absent(),
    bool? isStarred,
    int? rating,
    int? sortIndex,
    bool? isActive,
    String? playbackState,
    Value<String?> localPath = const Value.absent(),
  }) => PlaybackQueue(
    id: id ?? this.id,
    trackId: trackId ?? this.trackId,
    title: title ?? this.title,
    artist: artist ?? this.artist,
    album: album ?? this.album,
    duration: duration ?? this.duration,
    coverArt: coverArt.present ? coverArt.value : this.coverArt,
    isStarred: isStarred ?? this.isStarred,
    rating: rating ?? this.rating,
    sortIndex: sortIndex ?? this.sortIndex,
    isActive: isActive ?? this.isActive,
    playbackState: playbackState ?? this.playbackState,
    localPath: localPath.present ? localPath.value : this.localPath,
  );
  PlaybackQueue copyWithCompanion(PlaybackQueuesCompanion data) {
    return PlaybackQueue(
      id: data.id.present ? data.id.value : this.id,
      trackId: data.trackId.present ? data.trackId.value : this.trackId,
      title: data.title.present ? data.title.value : this.title,
      artist: data.artist.present ? data.artist.value : this.artist,
      album: data.album.present ? data.album.value : this.album,
      duration: data.duration.present ? data.duration.value : this.duration,
      coverArt: data.coverArt.present ? data.coverArt.value : this.coverArt,
      isStarred: data.isStarred.present ? data.isStarred.value : this.isStarred,
      rating: data.rating.present ? data.rating.value : this.rating,
      sortIndex: data.sortIndex.present ? data.sortIndex.value : this.sortIndex,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
      playbackState: data.playbackState.present
          ? data.playbackState.value
          : this.playbackState,
      localPath: data.localPath.present ? data.localPath.value : this.localPath,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PlaybackQueue(')
          ..write('id: $id, ')
          ..write('trackId: $trackId, ')
          ..write('title: $title, ')
          ..write('artist: $artist, ')
          ..write('album: $album, ')
          ..write('duration: $duration, ')
          ..write('coverArt: $coverArt, ')
          ..write('isStarred: $isStarred, ')
          ..write('rating: $rating, ')
          ..write('sortIndex: $sortIndex, ')
          ..write('isActive: $isActive, ')
          ..write('playbackState: $playbackState, ')
          ..write('localPath: $localPath')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    trackId,
    title,
    artist,
    album,
    duration,
    coverArt,
    isStarred,
    rating,
    sortIndex,
    isActive,
    playbackState,
    localPath,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PlaybackQueue &&
          other.id == this.id &&
          other.trackId == this.trackId &&
          other.title == this.title &&
          other.artist == this.artist &&
          other.album == this.album &&
          other.duration == this.duration &&
          other.coverArt == this.coverArt &&
          other.isStarred == this.isStarred &&
          other.rating == this.rating &&
          other.sortIndex == this.sortIndex &&
          other.isActive == this.isActive &&
          other.playbackState == this.playbackState &&
          other.localPath == this.localPath);
}

class PlaybackQueuesCompanion extends UpdateCompanion<PlaybackQueue> {
  final Value<int> id;
  final Value<String> trackId;
  final Value<String> title;
  final Value<String> artist;
  final Value<String> album;
  final Value<int> duration;
  final Value<String?> coverArt;
  final Value<bool> isStarred;
  final Value<int> rating;
  final Value<int> sortIndex;
  final Value<bool> isActive;
  final Value<String> playbackState;
  final Value<String?> localPath;
  const PlaybackQueuesCompanion({
    this.id = const Value.absent(),
    this.trackId = const Value.absent(),
    this.title = const Value.absent(),
    this.artist = const Value.absent(),
    this.album = const Value.absent(),
    this.duration = const Value.absent(),
    this.coverArt = const Value.absent(),
    this.isStarred = const Value.absent(),
    this.rating = const Value.absent(),
    this.sortIndex = const Value.absent(),
    this.isActive = const Value.absent(),
    this.playbackState = const Value.absent(),
    this.localPath = const Value.absent(),
  });
  PlaybackQueuesCompanion.insert({
    this.id = const Value.absent(),
    required String trackId,
    this.title = const Value.absent(),
    this.artist = const Value.absent(),
    this.album = const Value.absent(),
    this.duration = const Value.absent(),
    this.coverArt = const Value.absent(),
    this.isStarred = const Value.absent(),
    this.rating = const Value.absent(),
    required int sortIndex,
    this.isActive = const Value.absent(),
    this.playbackState = const Value.absent(),
    this.localPath = const Value.absent(),
  }) : trackId = Value(trackId),
       sortIndex = Value(sortIndex);
  static Insertable<PlaybackQueue> custom({
    Expression<int>? id,
    Expression<String>? trackId,
    Expression<String>? title,
    Expression<String>? artist,
    Expression<String>? album,
    Expression<int>? duration,
    Expression<String>? coverArt,
    Expression<bool>? isStarred,
    Expression<int>? rating,
    Expression<int>? sortIndex,
    Expression<bool>? isActive,
    Expression<String>? playbackState,
    Expression<String>? localPath,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (trackId != null) 'track_id': trackId,
      if (title != null) 'title': title,
      if (artist != null) 'artist': artist,
      if (album != null) 'album': album,
      if (duration != null) 'duration': duration,
      if (coverArt != null) 'cover_art': coverArt,
      if (isStarred != null) 'is_starred': isStarred,
      if (rating != null) 'rating': rating,
      if (sortIndex != null) 'sort_index': sortIndex,
      if (isActive != null) 'is_active': isActive,
      if (playbackState != null) 'playback_state': playbackState,
      if (localPath != null) 'local_path': localPath,
    });
  }

  PlaybackQueuesCompanion copyWith({
    Value<int>? id,
    Value<String>? trackId,
    Value<String>? title,
    Value<String>? artist,
    Value<String>? album,
    Value<int>? duration,
    Value<String?>? coverArt,
    Value<bool>? isStarred,
    Value<int>? rating,
    Value<int>? sortIndex,
    Value<bool>? isActive,
    Value<String>? playbackState,
    Value<String?>? localPath,
  }) {
    return PlaybackQueuesCompanion(
      id: id ?? this.id,
      trackId: trackId ?? this.trackId,
      title: title ?? this.title,
      artist: artist ?? this.artist,
      album: album ?? this.album,
      duration: duration ?? this.duration,
      coverArt: coverArt ?? this.coverArt,
      isStarred: isStarred ?? this.isStarred,
      rating: rating ?? this.rating,
      sortIndex: sortIndex ?? this.sortIndex,
      isActive: isActive ?? this.isActive,
      playbackState: playbackState ?? this.playbackState,
      localPath: localPath ?? this.localPath,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (trackId.present) {
      map['track_id'] = Variable<String>(trackId.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (artist.present) {
      map['artist'] = Variable<String>(artist.value);
    }
    if (album.present) {
      map['album'] = Variable<String>(album.value);
    }
    if (duration.present) {
      map['duration'] = Variable<int>(duration.value);
    }
    if (coverArt.present) {
      map['cover_art'] = Variable<String>(coverArt.value);
    }
    if (isStarred.present) {
      map['is_starred'] = Variable<bool>(isStarred.value);
    }
    if (rating.present) {
      map['rating'] = Variable<int>(rating.value);
    }
    if (sortIndex.present) {
      map['sort_index'] = Variable<int>(sortIndex.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<bool>(isActive.value);
    }
    if (playbackState.present) {
      map['playback_state'] = Variable<String>(playbackState.value);
    }
    if (localPath.present) {
      map['local_path'] = Variable<String>(localPath.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PlaybackQueuesCompanion(')
          ..write('id: $id, ')
          ..write('trackId: $trackId, ')
          ..write('title: $title, ')
          ..write('artist: $artist, ')
          ..write('album: $album, ')
          ..write('duration: $duration, ')
          ..write('coverArt: $coverArt, ')
          ..write('isStarred: $isStarred, ')
          ..write('rating: $rating, ')
          ..write('sortIndex: $sortIndex, ')
          ..write('isActive: $isActive, ')
          ..write('playbackState: $playbackState, ')
          ..write('localPath: $localPath')
          ..write(')'))
        .toString();
  }
}

class $OfflineAssetsTable extends OfflineAssets
    with TableInfo<$OfflineAssetsTable, OfflineAsset> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OfflineAssetsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _trackIdMeta = const VerificationMeta(
    'trackId',
  );
  @override
  late final GeneratedColumn<String> trackId = GeneratedColumn<String>(
    'track_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _localAudioPathMeta = const VerificationMeta(
    'localAudioPath',
  );
  @override
  late final GeneratedColumn<String> localAudioPath = GeneratedColumn<String>(
    'local_audio_path',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _localCoverPathMeta = const VerificationMeta(
    'localCoverPath',
  );
  @override
  late final GeneratedColumn<String> localCoverPath = GeneratedColumn<String>(
    'local_cover_path',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _localLyricsPathMeta = const VerificationMeta(
    'localLyricsPath',
  );
  @override
  late final GeneratedColumn<String> localLyricsPath = GeneratedColumn<String>(
    'local_lyrics_path',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _downloadStatusMeta = const VerificationMeta(
    'downloadStatus',
  );
  @override
  late final GeneratedColumn<String> downloadStatus = GeneratedColumn<String>(
    'download_status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _fileSizeBytesMeta = const VerificationMeta(
    'fileSizeBytes',
  );
  @override
  late final GeneratedColumn<int> fileSizeBytes = GeneratedColumn<int>(
    'file_size_bytes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastAccessedTimestampMeta =
      const VerificationMeta('lastAccessedTimestamp');
  @override
  late final GeneratedColumn<int> lastAccessedTimestamp = GeneratedColumn<int>(
    'last_accessed_timestamp',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  @override
  List<GeneratedColumn> get $columns => [
    trackId,
    localAudioPath,
    localCoverPath,
    localLyricsPath,
    downloadStatus,
    fileSizeBytes,
    lastAccessedTimestamp,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'offline_assets';
  @override
  VerificationContext validateIntegrity(
    Insertable<OfflineAsset> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('track_id')) {
      context.handle(
        _trackIdMeta,
        trackId.isAcceptableOrUnknown(data['track_id']!, _trackIdMeta),
      );
    } else if (isInserting) {
      context.missing(_trackIdMeta);
    }
    if (data.containsKey('local_audio_path')) {
      context.handle(
        _localAudioPathMeta,
        localAudioPath.isAcceptableOrUnknown(
          data['local_audio_path']!,
          _localAudioPathMeta,
        ),
      );
    }
    if (data.containsKey('local_cover_path')) {
      context.handle(
        _localCoverPathMeta,
        localCoverPath.isAcceptableOrUnknown(
          data['local_cover_path']!,
          _localCoverPathMeta,
        ),
      );
    }
    if (data.containsKey('local_lyrics_path')) {
      context.handle(
        _localLyricsPathMeta,
        localLyricsPath.isAcceptableOrUnknown(
          data['local_lyrics_path']!,
          _localLyricsPathMeta,
        ),
      );
    }
    if (data.containsKey('download_status')) {
      context.handle(
        _downloadStatusMeta,
        downloadStatus.isAcceptableOrUnknown(
          data['download_status']!,
          _downloadStatusMeta,
        ),
      );
    }
    if (data.containsKey('file_size_bytes')) {
      context.handle(
        _fileSizeBytesMeta,
        fileSizeBytes.isAcceptableOrUnknown(
          data['file_size_bytes']!,
          _fileSizeBytesMeta,
        ),
      );
    }
    if (data.containsKey('last_accessed_timestamp')) {
      context.handle(
        _lastAccessedTimestampMeta,
        lastAccessedTimestamp.isAcceptableOrUnknown(
          data['last_accessed_timestamp']!,
          _lastAccessedTimestampMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {trackId};
  @override
  OfflineAsset map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OfflineAsset(
      trackId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}track_id'],
      )!,
      localAudioPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_audio_path'],
      ),
      localCoverPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_cover_path'],
      ),
      localLyricsPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_lyrics_path'],
      ),
      downloadStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}download_status'],
      )!,
      fileSizeBytes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}file_size_bytes'],
      )!,
      lastAccessedTimestamp: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}last_accessed_timestamp'],
      )!,
    );
  }

  @override
  $OfflineAssetsTable createAlias(String alias) {
    return $OfflineAssetsTable(attachedDatabase, alias);
  }
}

class OfflineAsset extends DataClass implements Insertable<OfflineAsset> {
  final String trackId;
  final String? localAudioPath;
  final String? localCoverPath;
  final String? localLyricsPath;
  final String downloadStatus;
  final int fileSizeBytes;
  final int lastAccessedTimestamp;
  const OfflineAsset({
    required this.trackId,
    this.localAudioPath,
    this.localCoverPath,
    this.localLyricsPath,
    required this.downloadStatus,
    required this.fileSizeBytes,
    required this.lastAccessedTimestamp,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['track_id'] = Variable<String>(trackId);
    if (!nullToAbsent || localAudioPath != null) {
      map['local_audio_path'] = Variable<String>(localAudioPath);
    }
    if (!nullToAbsent || localCoverPath != null) {
      map['local_cover_path'] = Variable<String>(localCoverPath);
    }
    if (!nullToAbsent || localLyricsPath != null) {
      map['local_lyrics_path'] = Variable<String>(localLyricsPath);
    }
    map['download_status'] = Variable<String>(downloadStatus);
    map['file_size_bytes'] = Variable<int>(fileSizeBytes);
    map['last_accessed_timestamp'] = Variable<int>(lastAccessedTimestamp);
    return map;
  }

  OfflineAssetsCompanion toCompanion(bool nullToAbsent) {
    return OfflineAssetsCompanion(
      trackId: Value(trackId),
      localAudioPath: localAudioPath == null && nullToAbsent
          ? const Value.absent()
          : Value(localAudioPath),
      localCoverPath: localCoverPath == null && nullToAbsent
          ? const Value.absent()
          : Value(localCoverPath),
      localLyricsPath: localLyricsPath == null && nullToAbsent
          ? const Value.absent()
          : Value(localLyricsPath),
      downloadStatus: Value(downloadStatus),
      fileSizeBytes: Value(fileSizeBytes),
      lastAccessedTimestamp: Value(lastAccessedTimestamp),
    );
  }

  factory OfflineAsset.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OfflineAsset(
      trackId: serializer.fromJson<String>(json['trackId']),
      localAudioPath: serializer.fromJson<String?>(json['localAudioPath']),
      localCoverPath: serializer.fromJson<String?>(json['localCoverPath']),
      localLyricsPath: serializer.fromJson<String?>(json['localLyricsPath']),
      downloadStatus: serializer.fromJson<String>(json['downloadStatus']),
      fileSizeBytes: serializer.fromJson<int>(json['fileSizeBytes']),
      lastAccessedTimestamp: serializer.fromJson<int>(
        json['lastAccessedTimestamp'],
      ),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'trackId': serializer.toJson<String>(trackId),
      'localAudioPath': serializer.toJson<String?>(localAudioPath),
      'localCoverPath': serializer.toJson<String?>(localCoverPath),
      'localLyricsPath': serializer.toJson<String?>(localLyricsPath),
      'downloadStatus': serializer.toJson<String>(downloadStatus),
      'fileSizeBytes': serializer.toJson<int>(fileSizeBytes),
      'lastAccessedTimestamp': serializer.toJson<int>(lastAccessedTimestamp),
    };
  }

  OfflineAsset copyWith({
    String? trackId,
    Value<String?> localAudioPath = const Value.absent(),
    Value<String?> localCoverPath = const Value.absent(),
    Value<String?> localLyricsPath = const Value.absent(),
    String? downloadStatus,
    int? fileSizeBytes,
    int? lastAccessedTimestamp,
  }) => OfflineAsset(
    trackId: trackId ?? this.trackId,
    localAudioPath: localAudioPath.present
        ? localAudioPath.value
        : this.localAudioPath,
    localCoverPath: localCoverPath.present
        ? localCoverPath.value
        : this.localCoverPath,
    localLyricsPath: localLyricsPath.present
        ? localLyricsPath.value
        : this.localLyricsPath,
    downloadStatus: downloadStatus ?? this.downloadStatus,
    fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
    lastAccessedTimestamp: lastAccessedTimestamp ?? this.lastAccessedTimestamp,
  );
  OfflineAsset copyWithCompanion(OfflineAssetsCompanion data) {
    return OfflineAsset(
      trackId: data.trackId.present ? data.trackId.value : this.trackId,
      localAudioPath: data.localAudioPath.present
          ? data.localAudioPath.value
          : this.localAudioPath,
      localCoverPath: data.localCoverPath.present
          ? data.localCoverPath.value
          : this.localCoverPath,
      localLyricsPath: data.localLyricsPath.present
          ? data.localLyricsPath.value
          : this.localLyricsPath,
      downloadStatus: data.downloadStatus.present
          ? data.downloadStatus.value
          : this.downloadStatus,
      fileSizeBytes: data.fileSizeBytes.present
          ? data.fileSizeBytes.value
          : this.fileSizeBytes,
      lastAccessedTimestamp: data.lastAccessedTimestamp.present
          ? data.lastAccessedTimestamp.value
          : this.lastAccessedTimestamp,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OfflineAsset(')
          ..write('trackId: $trackId, ')
          ..write('localAudioPath: $localAudioPath, ')
          ..write('localCoverPath: $localCoverPath, ')
          ..write('localLyricsPath: $localLyricsPath, ')
          ..write('downloadStatus: $downloadStatus, ')
          ..write('fileSizeBytes: $fileSizeBytes, ')
          ..write('lastAccessedTimestamp: $lastAccessedTimestamp')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    trackId,
    localAudioPath,
    localCoverPath,
    localLyricsPath,
    downloadStatus,
    fileSizeBytes,
    lastAccessedTimestamp,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OfflineAsset &&
          other.trackId == this.trackId &&
          other.localAudioPath == this.localAudioPath &&
          other.localCoverPath == this.localCoverPath &&
          other.localLyricsPath == this.localLyricsPath &&
          other.downloadStatus == this.downloadStatus &&
          other.fileSizeBytes == this.fileSizeBytes &&
          other.lastAccessedTimestamp == this.lastAccessedTimestamp);
}

class OfflineAssetsCompanion extends UpdateCompanion<OfflineAsset> {
  final Value<String> trackId;
  final Value<String?> localAudioPath;
  final Value<String?> localCoverPath;
  final Value<String?> localLyricsPath;
  final Value<String> downloadStatus;
  final Value<int> fileSizeBytes;
  final Value<int> lastAccessedTimestamp;
  final Value<int> rowid;
  const OfflineAssetsCompanion({
    this.trackId = const Value.absent(),
    this.localAudioPath = const Value.absent(),
    this.localCoverPath = const Value.absent(),
    this.localLyricsPath = const Value.absent(),
    this.downloadStatus = const Value.absent(),
    this.fileSizeBytes = const Value.absent(),
    this.lastAccessedTimestamp = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OfflineAssetsCompanion.insert({
    required String trackId,
    this.localAudioPath = const Value.absent(),
    this.localCoverPath = const Value.absent(),
    this.localLyricsPath = const Value.absent(),
    this.downloadStatus = const Value.absent(),
    this.fileSizeBytes = const Value.absent(),
    this.lastAccessedTimestamp = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : trackId = Value(trackId);
  static Insertable<OfflineAsset> custom({
    Expression<String>? trackId,
    Expression<String>? localAudioPath,
    Expression<String>? localCoverPath,
    Expression<String>? localLyricsPath,
    Expression<String>? downloadStatus,
    Expression<int>? fileSizeBytes,
    Expression<int>? lastAccessedTimestamp,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (trackId != null) 'track_id': trackId,
      if (localAudioPath != null) 'local_audio_path': localAudioPath,
      if (localCoverPath != null) 'local_cover_path': localCoverPath,
      if (localLyricsPath != null) 'local_lyrics_path': localLyricsPath,
      if (downloadStatus != null) 'download_status': downloadStatus,
      if (fileSizeBytes != null) 'file_size_bytes': fileSizeBytes,
      if (lastAccessedTimestamp != null)
        'last_accessed_timestamp': lastAccessedTimestamp,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OfflineAssetsCompanion copyWith({
    Value<String>? trackId,
    Value<String?>? localAudioPath,
    Value<String?>? localCoverPath,
    Value<String?>? localLyricsPath,
    Value<String>? downloadStatus,
    Value<int>? fileSizeBytes,
    Value<int>? lastAccessedTimestamp,
    Value<int>? rowid,
  }) {
    return OfflineAssetsCompanion(
      trackId: trackId ?? this.trackId,
      localAudioPath: localAudioPath ?? this.localAudioPath,
      localCoverPath: localCoverPath ?? this.localCoverPath,
      localLyricsPath: localLyricsPath ?? this.localLyricsPath,
      downloadStatus: downloadStatus ?? this.downloadStatus,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      lastAccessedTimestamp:
          lastAccessedTimestamp ?? this.lastAccessedTimestamp,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (trackId.present) {
      map['track_id'] = Variable<String>(trackId.value);
    }
    if (localAudioPath.present) {
      map['local_audio_path'] = Variable<String>(localAudioPath.value);
    }
    if (localCoverPath.present) {
      map['local_cover_path'] = Variable<String>(localCoverPath.value);
    }
    if (localLyricsPath.present) {
      map['local_lyrics_path'] = Variable<String>(localLyricsPath.value);
    }
    if (downloadStatus.present) {
      map['download_status'] = Variable<String>(downloadStatus.value);
    }
    if (fileSizeBytes.present) {
      map['file_size_bytes'] = Variable<int>(fileSizeBytes.value);
    }
    if (lastAccessedTimestamp.present) {
      map['last_accessed_timestamp'] = Variable<int>(
        lastAccessedTimestamp.value,
      );
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OfflineAssetsCompanion(')
          ..write('trackId: $trackId, ')
          ..write('localAudioPath: $localAudioPath, ')
          ..write('localCoverPath: $localCoverPath, ')
          ..write('localLyricsPath: $localLyricsPath, ')
          ..write('downloadStatus: $downloadStatus, ')
          ..write('fileSizeBytes: $fileSizeBytes, ')
          ..write('lastAccessedTimestamp: $lastAccessedTimestamp, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $PlaybackQueuesTable playbackQueues = $PlaybackQueuesTable(this);
  late final $OfflineAssetsTable offlineAssets = $OfflineAssetsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    playbackQueues,
    offlineAssets,
  ];
}

typedef $$PlaybackQueuesTableCreateCompanionBuilder =
    PlaybackQueuesCompanion Function({
      Value<int> id,
      required String trackId,
      Value<String> title,
      Value<String> artist,
      Value<String> album,
      Value<int> duration,
      Value<String?> coverArt,
      Value<bool> isStarred,
      Value<int> rating,
      required int sortIndex,
      Value<bool> isActive,
      Value<String> playbackState,
      Value<String?> localPath,
    });
typedef $$PlaybackQueuesTableUpdateCompanionBuilder =
    PlaybackQueuesCompanion Function({
      Value<int> id,
      Value<String> trackId,
      Value<String> title,
      Value<String> artist,
      Value<String> album,
      Value<int> duration,
      Value<String?> coverArt,
      Value<bool> isStarred,
      Value<int> rating,
      Value<int> sortIndex,
      Value<bool> isActive,
      Value<String> playbackState,
      Value<String?> localPath,
    });

class $$PlaybackQueuesTableFilterComposer
    extends Composer<_$AppDatabase, $PlaybackQueuesTable> {
  $$PlaybackQueuesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get trackId => $composableBuilder(
    column: $table.trackId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get artist => $composableBuilder(
    column: $table.artist,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get album => $composableBuilder(
    column: $table.album,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get duration => $composableBuilder(
    column: $table.duration,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get coverArt => $composableBuilder(
    column: $table.coverArt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isStarred => $composableBuilder(
    column: $table.isStarred,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sortIndex => $composableBuilder(
    column: $table.sortIndex,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get playbackState => $composableBuilder(
    column: $table.playbackState,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localPath => $composableBuilder(
    column: $table.localPath,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PlaybackQueuesTableOrderingComposer
    extends Composer<_$AppDatabase, $PlaybackQueuesTable> {
  $$PlaybackQueuesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get trackId => $composableBuilder(
    column: $table.trackId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get artist => $composableBuilder(
    column: $table.artist,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get album => $composableBuilder(
    column: $table.album,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get duration => $composableBuilder(
    column: $table.duration,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get coverArt => $composableBuilder(
    column: $table.coverArt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isStarred => $composableBuilder(
    column: $table.isStarred,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sortIndex => $composableBuilder(
    column: $table.sortIndex,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get playbackState => $composableBuilder(
    column: $table.playbackState,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localPath => $composableBuilder(
    column: $table.localPath,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PlaybackQueuesTableAnnotationComposer
    extends Composer<_$AppDatabase, $PlaybackQueuesTable> {
  $$PlaybackQueuesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get trackId =>
      $composableBuilder(column: $table.trackId, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get artist =>
      $composableBuilder(column: $table.artist, builder: (column) => column);

  GeneratedColumn<String> get album =>
      $composableBuilder(column: $table.album, builder: (column) => column);

  GeneratedColumn<int> get duration =>
      $composableBuilder(column: $table.duration, builder: (column) => column);

  GeneratedColumn<String> get coverArt =>
      $composableBuilder(column: $table.coverArt, builder: (column) => column);

  GeneratedColumn<bool> get isStarred =>
      $composableBuilder(column: $table.isStarred, builder: (column) => column);

  GeneratedColumn<int> get rating =>
      $composableBuilder(column: $table.rating, builder: (column) => column);

  GeneratedColumn<int> get sortIndex =>
      $composableBuilder(column: $table.sortIndex, builder: (column) => column);

  GeneratedColumn<bool> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);

  GeneratedColumn<String> get playbackState => $composableBuilder(
    column: $table.playbackState,
    builder: (column) => column,
  );

  GeneratedColumn<String> get localPath =>
      $composableBuilder(column: $table.localPath, builder: (column) => column);
}

class $$PlaybackQueuesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PlaybackQueuesTable,
          PlaybackQueue,
          $$PlaybackQueuesTableFilterComposer,
          $$PlaybackQueuesTableOrderingComposer,
          $$PlaybackQueuesTableAnnotationComposer,
          $$PlaybackQueuesTableCreateCompanionBuilder,
          $$PlaybackQueuesTableUpdateCompanionBuilder,
          (
            PlaybackQueue,
            BaseReferences<_$AppDatabase, $PlaybackQueuesTable, PlaybackQueue>,
          ),
          PlaybackQueue,
          PrefetchHooks Function()
        > {
  $$PlaybackQueuesTableTableManager(
    _$AppDatabase db,
    $PlaybackQueuesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PlaybackQueuesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PlaybackQueuesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PlaybackQueuesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> trackId = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> artist = const Value.absent(),
                Value<String> album = const Value.absent(),
                Value<int> duration = const Value.absent(),
                Value<String?> coverArt = const Value.absent(),
                Value<bool> isStarred = const Value.absent(),
                Value<int> rating = const Value.absent(),
                Value<int> sortIndex = const Value.absent(),
                Value<bool> isActive = const Value.absent(),
                Value<String> playbackState = const Value.absent(),
                Value<String?> localPath = const Value.absent(),
              }) => PlaybackQueuesCompanion(
                id: id,
                trackId: trackId,
                title: title,
                artist: artist,
                album: album,
                duration: duration,
                coverArt: coverArt,
                isStarred: isStarred,
                rating: rating,
                sortIndex: sortIndex,
                isActive: isActive,
                playbackState: playbackState,
                localPath: localPath,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String trackId,
                Value<String> title = const Value.absent(),
                Value<String> artist = const Value.absent(),
                Value<String> album = const Value.absent(),
                Value<int> duration = const Value.absent(),
                Value<String?> coverArt = const Value.absent(),
                Value<bool> isStarred = const Value.absent(),
                Value<int> rating = const Value.absent(),
                required int sortIndex,
                Value<bool> isActive = const Value.absent(),
                Value<String> playbackState = const Value.absent(),
                Value<String?> localPath = const Value.absent(),
              }) => PlaybackQueuesCompanion.insert(
                id: id,
                trackId: trackId,
                title: title,
                artist: artist,
                album: album,
                duration: duration,
                coverArt: coverArt,
                isStarred: isStarred,
                rating: rating,
                sortIndex: sortIndex,
                isActive: isActive,
                playbackState: playbackState,
                localPath: localPath,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PlaybackQueuesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PlaybackQueuesTable,
      PlaybackQueue,
      $$PlaybackQueuesTableFilterComposer,
      $$PlaybackQueuesTableOrderingComposer,
      $$PlaybackQueuesTableAnnotationComposer,
      $$PlaybackQueuesTableCreateCompanionBuilder,
      $$PlaybackQueuesTableUpdateCompanionBuilder,
      (
        PlaybackQueue,
        BaseReferences<_$AppDatabase, $PlaybackQueuesTable, PlaybackQueue>,
      ),
      PlaybackQueue,
      PrefetchHooks Function()
    >;
typedef $$OfflineAssetsTableCreateCompanionBuilder =
    OfflineAssetsCompanion Function({
      required String trackId,
      Value<String?> localAudioPath,
      Value<String?> localCoverPath,
      Value<String?> localLyricsPath,
      Value<String> downloadStatus,
      Value<int> fileSizeBytes,
      Value<int> lastAccessedTimestamp,
      Value<int> rowid,
    });
typedef $$OfflineAssetsTableUpdateCompanionBuilder =
    OfflineAssetsCompanion Function({
      Value<String> trackId,
      Value<String?> localAudioPath,
      Value<String?> localCoverPath,
      Value<String?> localLyricsPath,
      Value<String> downloadStatus,
      Value<int> fileSizeBytes,
      Value<int> lastAccessedTimestamp,
      Value<int> rowid,
    });

class $$OfflineAssetsTableFilterComposer
    extends Composer<_$AppDatabase, $OfflineAssetsTable> {
  $$OfflineAssetsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get trackId => $composableBuilder(
    column: $table.trackId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localAudioPath => $composableBuilder(
    column: $table.localAudioPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localCoverPath => $composableBuilder(
    column: $table.localCoverPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localLyricsPath => $composableBuilder(
    column: $table.localLyricsPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get downloadStatus => $composableBuilder(
    column: $table.downloadStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get fileSizeBytes => $composableBuilder(
    column: $table.fileSizeBytes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lastAccessedTimestamp => $composableBuilder(
    column: $table.lastAccessedTimestamp,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OfflineAssetsTableOrderingComposer
    extends Composer<_$AppDatabase, $OfflineAssetsTable> {
  $$OfflineAssetsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get trackId => $composableBuilder(
    column: $table.trackId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localAudioPath => $composableBuilder(
    column: $table.localAudioPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localCoverPath => $composableBuilder(
    column: $table.localCoverPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localLyricsPath => $composableBuilder(
    column: $table.localLyricsPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get downloadStatus => $composableBuilder(
    column: $table.downloadStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get fileSizeBytes => $composableBuilder(
    column: $table.fileSizeBytes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lastAccessedTimestamp => $composableBuilder(
    column: $table.lastAccessedTimestamp,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OfflineAssetsTableAnnotationComposer
    extends Composer<_$AppDatabase, $OfflineAssetsTable> {
  $$OfflineAssetsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get trackId =>
      $composableBuilder(column: $table.trackId, builder: (column) => column);

  GeneratedColumn<String> get localAudioPath => $composableBuilder(
    column: $table.localAudioPath,
    builder: (column) => column,
  );

  GeneratedColumn<String> get localCoverPath => $composableBuilder(
    column: $table.localCoverPath,
    builder: (column) => column,
  );

  GeneratedColumn<String> get localLyricsPath => $composableBuilder(
    column: $table.localLyricsPath,
    builder: (column) => column,
  );

  GeneratedColumn<String> get downloadStatus => $composableBuilder(
    column: $table.downloadStatus,
    builder: (column) => column,
  );

  GeneratedColumn<int> get fileSizeBytes => $composableBuilder(
    column: $table.fileSizeBytes,
    builder: (column) => column,
  );

  GeneratedColumn<int> get lastAccessedTimestamp => $composableBuilder(
    column: $table.lastAccessedTimestamp,
    builder: (column) => column,
  );
}

class $$OfflineAssetsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OfflineAssetsTable,
          OfflineAsset,
          $$OfflineAssetsTableFilterComposer,
          $$OfflineAssetsTableOrderingComposer,
          $$OfflineAssetsTableAnnotationComposer,
          $$OfflineAssetsTableCreateCompanionBuilder,
          $$OfflineAssetsTableUpdateCompanionBuilder,
          (
            OfflineAsset,
            BaseReferences<_$AppDatabase, $OfflineAssetsTable, OfflineAsset>,
          ),
          OfflineAsset,
          PrefetchHooks Function()
        > {
  $$OfflineAssetsTableTableManager(_$AppDatabase db, $OfflineAssetsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OfflineAssetsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OfflineAssetsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OfflineAssetsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> trackId = const Value.absent(),
                Value<String?> localAudioPath = const Value.absent(),
                Value<String?> localCoverPath = const Value.absent(),
                Value<String?> localLyricsPath = const Value.absent(),
                Value<String> downloadStatus = const Value.absent(),
                Value<int> fileSizeBytes = const Value.absent(),
                Value<int> lastAccessedTimestamp = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => OfflineAssetsCompanion(
                trackId: trackId,
                localAudioPath: localAudioPath,
                localCoverPath: localCoverPath,
                localLyricsPath: localLyricsPath,
                downloadStatus: downloadStatus,
                fileSizeBytes: fileSizeBytes,
                lastAccessedTimestamp: lastAccessedTimestamp,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String trackId,
                Value<String?> localAudioPath = const Value.absent(),
                Value<String?> localCoverPath = const Value.absent(),
                Value<String?> localLyricsPath = const Value.absent(),
                Value<String> downloadStatus = const Value.absent(),
                Value<int> fileSizeBytes = const Value.absent(),
                Value<int> lastAccessedTimestamp = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => OfflineAssetsCompanion.insert(
                trackId: trackId,
                localAudioPath: localAudioPath,
                localCoverPath: localCoverPath,
                localLyricsPath: localLyricsPath,
                downloadStatus: downloadStatus,
                fileSizeBytes: fileSizeBytes,
                lastAccessedTimestamp: lastAccessedTimestamp,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OfflineAssetsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OfflineAssetsTable,
      OfflineAsset,
      $$OfflineAssetsTableFilterComposer,
      $$OfflineAssetsTableOrderingComposer,
      $$OfflineAssetsTableAnnotationComposer,
      $$OfflineAssetsTableCreateCompanionBuilder,
      $$OfflineAssetsTableUpdateCompanionBuilder,
      (
        OfflineAsset,
        BaseReferences<_$AppDatabase, $OfflineAssetsTable, OfflineAsset>,
      ),
      OfflineAsset,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$PlaybackQueuesTableTableManager get playbackQueues =>
      $$PlaybackQueuesTableTableManager(_db, _db.playbackQueues);
  $$OfflineAssetsTableTableManager get offlineAssets =>
      $$OfflineAssetsTableTableManager(_db, _db.offlineAssets);
}
